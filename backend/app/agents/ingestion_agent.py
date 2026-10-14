import logging
import os
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import Material, DocumentChunk
from app.ingestion.pdf_processor import DocumentProcessingError, PDFProcessor
from app.ingestion.pptx_processor import PPTXProcessor
from app.ingestion.video_processor import VideoProcessor
from app.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)

class MultimodalIngestionAgent:
    """
    AGENT 1: MULTIMODAL INGESTION AGENT
    Ingests PDFs, PPT/PPTX slides, and Lecture videos.
    Extracts text, preserves exact source metadata (page, slide, timestamp), and embeds chunks into vector store.
    """
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = VectorStore(db)

    def process_material(self, material_id: str) -> Dict[str, Any]:
        material = self.db.query(Material).filter(Material.id == material_id).first()
        if not material:
            return {"status": "error", "message": "Material not found"}

        try:
            material.status = "processing"
            self.db.commit()

            raw_chunks = []
            file_ext = material.file_type.lower()
            file_path = material.file_path
            stored_name = os.path.basename(file_path)
            prefix = f"{material.course_id}_"
            stored_suffix = stored_name[len(prefix):] if stored_name.startswith(prefix) else stored_name
            source_name = stored_suffix.split("_", 1)[-1] if stored_name.startswith(prefix) else material.title

            if file_ext in {"pdf", "docx", "text", "txt", "md", "markdown"}:
                raw_chunks = PDFProcessor.extract_chunks(
                    file_path=file_path,
                    course_id=material.course_id,
                    material_id=material.id,
                    source_name=source_name,
                    file_type=file_ext,
                )
            elif file_ext == "pptx":
                raw_chunks = PPTXProcessor.extract_chunks(
                    file_path=file_path,
                    course_id=material.course_id,
                    material_id=material.id,
                    source_name=source_name
                )
            elif file_ext == "video":
                raw_chunks = VideoProcessor.extract_chunks(
                    file_path=file_path,
                    course_id=material.course_id,
                    material_id=material.id,
                    source_name=source_name
                )
            else:
                raise DocumentProcessingError("This document format is not supported for text extraction.")

            if not raw_chunks:
                raise DocumentProcessingError(
                    "No readable text could be extracted. The document was not indexed."
                )

            created_chunks = self.vector_store.add_chunks(raw_chunks)
            if not created_chunks:
                raise DocumentProcessingError("No validated study text was available to index.")
            material.status = "completed"
            material.error_message = None
            self.db.commit()

            return {
                "status": "completed",
                "material_id": material.id,
                "chunks_created": len(created_chunks),
                "source_name": source_name
            }
        except DocumentProcessingError as e:
            self.db.rollback()
            material = self.db.query(Material).filter(Material.id == material_id).first()
            material.status = "error"
            material.error_message = str(e)
            self.db.commit()
            return {"status": "error", "message": str(e)}
        except Exception:
            logger.exception("Unexpected document ingestion failure for material %s", material_id)
            self.db.rollback()
            material = self.db.query(Material).filter(Material.id == material_id).first()
            material.status = "error"
            material.error_message = "The document could not be processed due to an internal ingestion error."
            self.db.commit()
            return {"status": "error", "message": material.error_message}
