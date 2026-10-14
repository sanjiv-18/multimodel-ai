import json
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.db_models import DocumentChunk, Material
from app.rag.embeddings import EmbeddingService
from app.ingestion.pdf_processor import is_readable_content

class VectorStore:
    def __init__(self, db: Session):
        self.db = db

    def add_chunks(self, chunks: List[Dict[str, Any]]) -> List[DocumentChunk]:
        db_chunks = []
        for ch in chunks:
            if not is_readable_content(ch.get("content", "")):
                continue
            vector = EmbeddingService.get_embedding_vector(ch["content"])
            db_chunk = DocumentChunk(
                course_id=ch["course_id"],
                material_id=ch["material_id"],
                material_type=ch.get("material_type", "pdf"),
                source_name=ch.get("source_name", "Course Material"),
                page_number=ch.get("page_number"),
                slide_number=ch.get("slide_number"),
                video_timestamp=ch.get("video_timestamp"),
                topic=ch.get("topic"),
                concept=ch.get("concept"),
                content=ch["content"],
                embedding_json=json.dumps(vector)
            )
            self.db.add(db_chunk)
            db_chunks.append(db_chunk)
        self.db.commit()
        return db_chunks

    def similarity_search(
        self,
        course_id: str,
        query: str,
        top_k: int = 4,
        topic_filter: str = None,
        material_id: str = None,
    ) -> List[Tuple[DocumentChunk, float]]:
        query_vector = EmbeddingService.get_embedding_vector(query)
        
        query_set = self.db.query(DocumentChunk).join(
            Material, Material.id == DocumentChunk.material_id
        ).filter(
            DocumentChunk.course_id == course_id,
            Material.status == "completed",
        )
        if material_id:
            query_set = query_set.filter(DocumentChunk.material_id == material_id)
        if topic_filter and topic_filter != "All":
            query_set = query_set.filter(DocumentChunk.topic.ilike(f"%{topic_filter}%"))
            
        chunks = query_set.all()
        scored_chunks = []
        
        for ch in chunks:
            if not is_readable_content(ch.content):
                continue
            if not ch.embedding_json:
                continue
            chunk_vector = json.loads(ch.embedding_json)
            score = EmbeddingService.compute_similarity(query_vector, chunk_vector)
            
            # Keyword boosting if exact tokens present
            query_tokens = set(EmbeddingService.tokenize(query))
            chunk_tokens = set(EmbeddingService.tokenize(ch.content))
            overlap = len(query_tokens.intersection(chunk_tokens))
            if overlap > 0:
                score += min(0.3, overlap * 0.05)
                
            scored_chunks.append((ch, score))
            
        # Sort descending by score
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]
