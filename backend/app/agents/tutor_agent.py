import json
import logging
import re
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.rag.retriever import CourseRetriever
from app.core.llm_provider import LLMProvider
from app.models.db_models import Conversation, Message
from app.schemas.pydantic_schemas import Citation

logger = logging.getLogger(__name__)
RAW_DOCUMENT_OUTPUT = re.compile(
    r"%PDF-\d|PdfReadError|Traceback \(most recent call last\)|"
    r"Unexpected EOF|Could not read malformed"
)
PDF_OBJECT = re.compile(r"\b\d+\s+\d+\s+obj\b")


def is_valid_tutor_response(response: str) -> bool:
    if not isinstance(response, str) or len(response.strip()) < 3:
        return False
    object_declarations = len(PDF_OBJECT.findall(response))
    object_terminators = len(re.findall(r"\bendobj\b|\bendstream\b", response))
    if (
        RAW_DOCUMENT_OUTPUT.search(response)
        or object_declarations >= 2
        or (object_declarations == 1 and object_terminators >= 2)
    ):
        return False
    nonprinting = sum(not char.isprintable() and char not in "\n\r\t" for char in response)
    return nonprinting / len(response) <= 0.02

class GroundedTutorAgent:
    """
    AGENT 3: GROUNDED TUTOR AGENT
    Performs RAG against uploaded course chunks.
    Enforces strict source grounding, generates clickable citations,
    and returns graceful refusal when query is out-of-domain.
    """
    def __init__(self, db: Session):
        self.db = db
        self.retriever = CourseRetriever(db)

    async def answer_query(
        self,
        course_id: str,
        user_id: str,
        query: str,
        conversation_id: str = None,
        material_id: str = None,
    ) -> Dict[str, Any]:
        retrieval_query = query
        if conversation_id and re.search(
            r"\b(again|simpler|simple|analogy|example|elaborate|clarify|that)\b",
            query,
            re.IGNORECASE,
        ):
            prior_question = self.db.query(Message).join(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.course_id == course_id,
                Conversation.user_id == user_id,
                Message.sender == "user",
            ).order_by(Message.created_at.desc()).first()
            if prior_question:
                retrieval_query = f"{prior_question.content}\nFollow-up request: {query}"

        # 1. Retrieve grounded context
        context_paragraphs, citations, is_supported = self.retriever.retrieve_grounded_context(
            course_id=course_id,
            query=retrieval_query,
            top_k=4,
            min_relevance_threshold=0.15,
            material_id=material_id,
        )

        # 2. If out of domain / not supported in uploaded material
        if not is_supported or not context_paragraphs:
            refusal_text = (
                "I couldn't find this information in your uploaded course material. "
                "To maintain strict academic integrity and source grounding, I only answer questions "
                "based on your uploaded textbooks, slide decks, and lecture recordings. "
                "Please upload relevant materials or ask about topics covered in this course."
            )
            
            # Save message
            conv = self._get_or_create_conversation(course_id, user_id, conversation_id, query)
            self._save_message(conv.id, "user", query, [], True)
            tutor_msg = self._save_message(conv.id, "tutor", refusal_text, [], False)

            return {
                "conversation_id": conv.id,
                "message": {
                    "id": tutor_msg.id,
                    "sender": "tutor",
                    "content": refusal_text,
                    "citations": [],
                    "is_grounded": False,
                    "created_at": tutor_msg.created_at
                }
            }

        # 3. Generate grounded answer
        system_prompt = (
            "You are LearnFlow AI, a clear and patient student tutor. Use only the supplied readable course excerpts "
            "for document-specific facts. Explain concepts step by step and use a simple analogy when requested. "
            "State when the excerpts do not contain a detail. Never claim an unsupported fact came from the material, "
            "invent a citation or page, or reproduce file bytes, PDF syntax, parser output, or diagnostics. "
            "Source references are displayed separately by the application; do not fabricate inline citations."
        )

        rag_context_str = "\n\n---\n\n".join(context_paragraphs)
        user_prompt = (
            f"COURSE MATERIAL EXCERPTS:\n{rag_context_str}\n\n"
            f"STUDENT QUESTION:\n{query}\n\n"
            "Answer as a helpful tutor. Be clear, student-friendly, and grounded in the excerpts."
        )
        raw_answer = await LLMProvider.generate_response(user_prompt, system_prompt=system_prompt)
        if not is_valid_tutor_response(raw_answer):
            logger.warning("Rejected malformed tutor response for course %s", course_id)
            retry_prompt = (
                user_prompt
                + "\n\nRewrite your answer as plain, readable educational prose. "
                "Do not include PDF internals, binary data, parser errors, or debugging output."
            )
            raw_answer = await LLMProvider.generate_response(retry_prompt, system_prompt=system_prompt)
        answer_is_valid = is_valid_tutor_response(raw_answer)
        if not answer_is_valid:
            logger.warning("Tutor retry remained malformed for course %s", course_id)
            raw_answer = (
                "I couldn't produce a readable answer from the retrieved course material. "
                "Please retry your question or reprocess the document."
            )

        # Append structured citation summary if not present
        citation_dicts = (
            [c.model_dump() if hasattr(c, "model_dump") else c.dict() for c in citations]
            if answer_is_valid else []
        )
        
        # Save to DB
        conv = self._get_or_create_conversation(course_id, user_id, conversation_id, query)
        self._save_message(conv.id, "user", query, [], True)
        tutor_msg = self._save_message(conv.id, "tutor", raw_answer, citation_dicts, answer_is_valid)

        return {
            "conversation_id": conv.id,
            "message": {
                "id": tutor_msg.id,
                "sender": "tutor",
                "content": raw_answer,
                "citations": citation_dicts,
                "is_grounded": answer_is_valid,
                "created_at": tutor_msg.created_at
            }
        }

    def _get_or_create_conversation(self, course_id: str, user_id: str, conv_id: str, query: str) -> Conversation:
        if conv_id:
            conv = self.db.query(Conversation).filter(Conversation.id == conv_id).first()
            if conv:
                return conv
        # Create new
        title = query[:40] + "..." if len(query) > 40 else query
        new_conv = Conversation(course_id=course_id, user_id=user_id, title=title)
        self.db.add(new_conv)
        self.db.commit()
        self.db.refresh(new_conv)
        return new_conv

    def _save_message(self, conv_id: str, sender: str, content: str, citations: list, is_grounded: bool) -> Message:
        msg = Message(
            conversation_id=conv_id,
            sender=sender,
            content=content,
            citations_json=json.dumps(citations),
            is_grounded=is_grounded
        )
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)
        return msg
