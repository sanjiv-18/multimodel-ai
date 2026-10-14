import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.db_models import Material, Course, DocumentChunk, User
from app.schemas.pydantic_schemas import MaterialOut, StudyGuideOut, StudySection, Citation
from app.agents.ingestion_agent import MultimodalIngestionAgent
from app.ingestion.pdf_processor import DocumentProcessingError, detect_file_type, is_readable_content

from app.core.config import settings
from app.api.auth import get_current_user

router = APIRouter(tags=["Materials"])

@router.post("/courses/{course_id}/materials", response_model=MaterialOut)
async def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    title: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Course belongs to another student.")

    filename = (file.filename or "uploaded_file").replace("\\", "/").split("/")[-1]
    file_title = title if title else filename
    content = await file.read()
    try:
        file_type = detect_file_type(filename, file.content_type, content)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Save to disk
    stored_filename = f"{course_id}_{uuid.uuid4().hex}_{filename}"
    save_path = os.path.join(settings.UPLOAD_DIR, stored_filename)
    with open(save_path, "wb") as buffer:
        buffer.write(content)

    file_size = os.path.getsize(save_path)

    material = Material(
        course_id=course_id,
        title=file_title,
        file_type=file_type,
        file_path=save_path,
        file_size_bytes=file_size,
        status="processing"
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    # Process ingestion synchronously
    ingestion_agent = MultimodalIngestionAgent(db)
    ingestion_agent.process_material(material.id)
    
    if material.status == "completed":
        # Trigger Agent 2 (Knowledge Org) to extract new topics & concepts from notes
        from app.agents.knowledge_agent import KnowledgeOrganizationAgent
        from app.agents.personalization_agent import PersonalizationAgent
        k_agent = KnowledgeOrganizationAgent(db)
        k_agent.organize_course_knowledge(course_id)

        # Trigger Agent 8 (Personalization) to create baseline recommendations
        p_agent = PersonalizationAgent(db)
        p_agent.generate_recommendations(current_user.id, course_id)

    db.refresh(material)

    chunk_count = db.query(DocumentChunk).filter(DocumentChunk.material_id == material.id).count()

    return MaterialOut(
        id=material.id,
        course_id=material.course_id,
        title=material.title,
        file_type=material.file_type,
        file_path=material.file_path,
        file_size_bytes=material.file_size_bytes,
        status=material.status,
        error_message=material.error_message,
        created_at=material.created_at,
        chunks_count=chunk_count
    )

@router.get("/courses/{course_id}/materials", response_model=List[MaterialOut])
def list_course_materials(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Course belongs to another student.")

    materials = db.query(Material).filter(Material.course_id == course_id).all()
    results = []

    for m in materials:
        chunk_count = db.query(DocumentChunk).filter(DocumentChunk.material_id == m.id).count()
        raw_topics = db.query(DocumentChunk.topic).filter(
            DocumentChunk.material_id == m.id,
            DocumentChunk.topic != None
        ).distinct().all()
        extracted_topics = [t[0] for t in raw_topics if t[0] and t[0].strip()]

        results.append(MaterialOut(
            id=m.id,
            course_id=m.course_id,
            title=m.title,
            file_type=m.file_type,
            file_path=m.file_path,
            file_size_bytes=m.file_size_bytes,
            status=m.status,
            error_message=m.error_message,
            created_at=m.created_at,
            chunks_count=chunk_count,
            extracted_topics=extracted_topics
        ))
    return results

@router.get("/materials/{material_id}/status")
def get_material_status(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    
    chunk_count = db.query(DocumentChunk).filter(DocumentChunk.material_id == material.id).count()
    raw_topics = db.query(DocumentChunk.topic).filter(
        DocumentChunk.material_id == material.id,
        DocumentChunk.topic != None
    ).distinct().all()
    extracted_topics = [t[0] for t in raw_topics if t[0] and t[0].strip()]

    return {
        "id": material.id,
        "title": material.title,
        "status": material.status,
        "file_type": material.file_type,
        "chunks_count": chunk_count,
        "extracted_topics": extracted_topics,
        "error_message": material.error_message
    }

@router.get("/courses/{course_id}/study-guide", response_model=StudyGuideOut)
def get_course_study_guide(
    course_id: str,
    material_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Course belongs to another student.")

    # Target specific material or all materials in course
    chunk_query = db.query(DocumentChunk).join(
        Material, Material.id == DocumentChunk.material_id
    ).filter(
        DocumentChunk.course_id == course_id,
        Material.status == "completed",
    )
    target_mat_title = None
    if material_id:
        target_mat = db.query(Material).filter(Material.id == material_id, Material.course_id == course_id).first()
        if not target_mat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified material not found in course")
        target_mat_title = target_mat.title
        chunk_query = chunk_query.filter(DocumentChunk.material_id == material_id)

    chunks = [chunk for chunk in chunk_query.all() if is_readable_content(chunk.content)]
    if not chunks:
        return StudyGuideOut(
            course_id=course_id,
            material_id=material_id,
            material_title=target_mat_title,
            title=f"Study Guide: {target_mat_title or course.title}",
            summary="I couldn't find enough information in your uploaded notes. Upload relevant material or choose another document to continue.",
            sections=[],
            key_definitions=[],
            revision_checklist=[],
            is_grounded=False
        )

    # Group chunks by topic
    topics_map = {}
    for ch in chunks:
        t_name = ch.topic or "Fundamental Principles"
        if t_name not in topics_map:
            topics_map[t_name] = []
        topics_map[t_name].append(ch)

    sections = []
    all_key_definitions = []
    all_checkpoints = []

    for t_name, t_chunks in topics_map.items():
        # Build synthesis from actual chunks
        sec_sentences = []
        sec_citations = []
        for ch in t_chunks:
            # Build citation
            snippet = ch.content[:160] + "..." if len(ch.content) > 160 else ch.content
            sec_citations.append(Citation(
                source_name=ch.source_name,
                material_type=ch.material_type,
                page_number=ch.page_number,
                slide_number=ch.slide_number,
                video_timestamp=ch.video_timestamp,
                topic=t_name,
                concept=ch.concept,
                snippet=snippet
            ))
            raw_sents = [s.strip() for s in ch.content.split(".") if len(s.strip()) > 20]
            sec_sentences.extend(raw_sents)

        key_pts = [s for s in sec_sentences[:4]]
        if not key_pts:
            key_pts = [f"Core study points for {t_name} extracted from source notes."]

        # Key definitions extracted from chunks if they contain "is" or "defined" or ":"
        for s in sec_sentences:
            if " is " in s or ":" in s:
                parts = s.split(" is ") if " is " in s else s.split(":")
                if len(parts) >= 2 and len(parts[0].strip()) < 40 and len(parts[1].strip()) > 15:
                    all_key_definitions.append({
                        "term": parts[0].strip(),
                        "definition": parts[1].strip()
                    })
                    break

        all_checkpoints.append(f"Master core principles of {t_name}")

        content_body = "\n\n".join([f"- {kp}" for kp in key_pts])
        sections.append(StudySection(
            title=t_name,
            content=f"Key concepts for {t_name} derived directly from your notes:\n\n{content_body}",
            key_points=key_pts,
            citations=sec_citations[:3]
        ))

    guide_title = f"Study Guide: {target_mat_title}" if target_mat_title else f"Course Study Guide: {course.title}"
    summary_text = (
        f"Grounded study guide synthesized directly from {len(chunks)} verified sections across "
        f"{target_mat_title or 'your uploaded class notes'}."
    )

    return StudyGuideOut(
        course_id=course_id,
        material_id=material_id,
        material_title=target_mat_title,
        title=guide_title,
        summary=summary_text,
        sections=sections,
        key_definitions=all_key_definitions[:6],
        revision_checklist=all_checkpoints,
        is_grounded=True
    )


@router.delete("/materials/{material_id}")
def delete_material(
    material_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    course = db.query(Course).filter(Course.id == material.course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete material from this course")

    # Delete physical file if exists
    if material.file_path and os.path.exists(material.file_path):
        try:
            os.remove(material.file_path)
        except Exception:
            pass

    # Delete document chunks
    db.query(DocumentChunk).filter(DocumentChunk.material_id == material.id).delete()
    
    # Delete material record
    db.delete(material)
    db.commit()

    # Refresh course knowledge organization
    from app.agents.knowledge_agent import KnowledgeOrganizationAgent
    from app.agents.personalization_agent import PersonalizationAgent
    k_agent = KnowledgeOrganizationAgent(db)
    k_agent.organize_course_knowledge(course.id)

    p_agent = PersonalizationAgent(db)
    p_agent.generate_recommendations(current_user.id, course.id)

    return {"status": "deleted", "material_id": material_id}
