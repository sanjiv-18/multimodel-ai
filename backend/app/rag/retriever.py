from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.rag.vector_store import VectorStore
from app.rag.embeddings import EmbeddingService
from app.schemas.pydantic_schemas import Citation

class CourseRetriever:
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = VectorStore(db)

    def retrieve_grounded_context(
        self,
        course_id: str,
        query: str,
        top_k: int = 4,
        min_relevance_threshold: float = 0.15,
        material_id: str = None,
    ) -> Tuple[List[str], List[Citation], bool]:
        """
        Retrieves context chunks and produces verified citation objects.
        Returns: (context_paragraphs, citations, is_supported)
        """
        scored_chunks = self.vector_store.similarity_search(
            course_id, query, top_k=top_k, material_id=material_id
        )
        
        # Check that query has non-trivial keyword overlap with retrieved content
        query_tokens = set(EmbeddingService.tokenize(query))
        has_overlap = False
        if scored_chunks:
            retrieved_tokens = set().union(*(
                set(EmbeddingService.tokenize(chunk.content))
                for chunk, _ in scored_chunks
            ))
            has_overlap = len(query_tokens.intersection(retrieved_tokens)) > 0

        # Check relevance
        if not scored_chunks or scored_chunks[0][1] < min_relevance_threshold or not has_overlap:
            return [], [], False
            
        context_paragraphs = []
        citations = []
        context_budget = 10000
        
        for chunk, score in scored_chunks:
            if score < min_relevance_threshold * 0.7 or context_budget <= 0:
                continue

            content = chunk.content[:context_budget]
            snippet = content[:200] + "..." if len(content) > 200 else content
            
            citation = Citation(
                source_name=chunk.source_name,
                material_type=chunk.material_type,
                page_number=chunk.page_number,
                slide_number=chunk.slide_number,
                video_timestamp=chunk.video_timestamp,
                topic=chunk.topic,
                concept=chunk.concept,
                snippet=snippet,
                relevance_score=round(score, 3)
            )
            citations.append(citation)
            
            # Format header for RAG context
            loc_label = ""
            if chunk.material_type == "pdf" and chunk.page_number:
                loc_label = f"Page {chunk.page_number}"
            elif chunk.material_type == "pptx" and chunk.slide_number:
                loc_label = f"Slide {chunk.slide_number}"
            elif chunk.material_type == "video" and chunk.video_timestamp:
                loc_label = f"Timestamp {chunk.video_timestamp}"
                
            header = f"[{chunk.source_name} — {loc_label}]" if loc_label else f"[{chunk.source_name}]"
            context_paragraphs.append(f"{header}\n{content}")
            context_budget -= len(content)
            
        is_supported = len(citations) > 0
        return context_paragraphs, citations, is_supported
