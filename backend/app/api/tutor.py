import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.db_models import Conversation, Message, Course, Material, User
from app.schemas.pydantic_schemas import ChatRequest, ChatResponse, ConversationOut, MessageOut, Citation
from app.agents.tutor_agent import GroundedTutorAgent
from app.api.auth import get_current_user

router = APIRouter(tags=["Tutor Chat"])

@router.post("/courses/{course_id}/chat", response_model=ChatResponse)
async def chat_with_tutor(
    course_id: str,
    chat_req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: This course belongs to another student.")

    if chat_req.material_id:
        material = db.query(Material).filter(
            Material.id == chat_req.material_id,
            Material.course_id == course_id,
        ).first()
        if not material:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in this course.")
        if material.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=material.error_message or "This document is not ready for questions yet.",
            )

    tutor_agent = GroundedTutorAgent(db)

    result = await tutor_agent.answer_query(
        course_id=course_id,
        user_id=current_user.id,
        query=chat_req.message,
        conversation_id=chat_req.conversation_id,
        material_id=chat_req.material_id,
    )

    msg_data = result["message"]
    citations_list = [Citation(**c) for c in msg_data["citations"]]

    return ChatResponse(
        conversation_id=result["conversation_id"],
        message=MessageOut(
            id=msg_data["id"],
            sender=msg_data["sender"],
            content=msg_data["content"],
            citations=citations_list,
            is_grounded=msg_data["is_grounded"],
            created_at=msg_data["created_at"]
        )
    )

@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(
    course_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    if course_id:
        query = query.filter(Conversation.course_id == course_id)
        
    convs = query.order_by(Conversation.created_at.desc()).all()
    results = []
    
    for c in convs:
        db_messages = db.query(Message).filter(Message.conversation_id == c.id).order_by(Message.created_at.asc()).all()
        msg_outs = []
        for m in db_messages:
            cits = json.loads(m.citations_json) if m.citations_json else []
            msg_outs.append(MessageOut(
                id=m.id,
                sender=m.sender,
                content=m.content,
                citations=[Citation(**cit) for cit in cits],
                is_grounded=m.is_grounded,
                created_at=m.created_at
            ))
        results.append(ConversationOut(
            id=c.id,
            course_id=c.course_id,
            title=c.title,
            created_at=c.created_at,
            messages=msg_outs
        ))
        
    return results
