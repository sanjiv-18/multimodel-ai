import json
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.db_models import Topic, Concept, LearnerMastery, User, Course
from app.schemas.pydantic_schemas import (
    TopicOut,
    ConceptOut,
    KnowledgeMapOut,
    SyllabusSnapshotOut,
    SyllabusItemOut,
    SyllabusSyncRequest,
)
from app.agents.knowledge_agent import KnowledgeOrganizationAgent
from app.api.auth import get_current_user

router = APIRouter(prefix="/courses/{course_id}", tags=["Knowledge Map & Topics"])

GENERIC_TOPIC_FILTER = {
    "course overview",
    "learning outcomes",
    "syllabus",
    "exam preparation",
    "revision",
    "assessment",
    "assessment criteria",
    "introduction",
    "summary",
    "overview",
}


def _status_from_mastery(mastery_score: float) -> str:
    if mastery_score >= 0.8:
        return "Mastered"
    if mastery_score >= 0.6:
        return "Revision Needed"
    if mastery_score >= 0.35:
        return "Needs Practice"
    if mastery_score > 0:
        return "Learning"
    return "Not Started"


def _normalize_topic_name(raw: str) -> str:
    value = (raw or "").strip()
    value = re.sub(r"^(unit|topic|chapter|module|week)\s*\d*[:.-]?\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^[\-•*\d\)\.]\s*", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -:;")


def _extract_syllabus_candidates(syllabus_text: str, provided_topics: List[str] = None, unit_names: List[str] = None) -> List[str]:
    candidates: List[str] = []
    seen = set()

    for raw in (provided_topics or []) + (unit_names or []):
        name = _normalize_topic_name(raw)
        if not name or name.lower() in GENERIC_TOPIC_FILTER:
            continue
        if name.lower() not in seen:
            seen.add(name.lower())
            candidates.append(name)

    if not syllabus_text:
        return candidates

    for line in syllabus_text.splitlines():
        value = re.sub(r"^\s*[-*•]\s*", "", line).strip()
        if not value:
            continue
        value = re.sub(r"^\d+[\.)]\s*", "", value)
        value = value.strip()
        if not value or len(value) > 120:
            continue
        if any(token in value.lower() for token in ["exam", "assessment", "course overview", "learning outcomes", "syllabus"]):
            continue
        if re.fullmatch(r"(?:unit|topic|chapter|module|week)\s*\d*[:.-]?\s*", value, flags=re.IGNORECASE):
            continue
        normalized = _normalize_topic_name(value)
        if not normalized or normalized.lower() in GENERIC_TOPIC_FILTER:
            continue
        if len(normalized.split()) > 12:
            continue
        if normalized.lower() not in seen:
            seen.add(normalized.lower())
            candidates.append(normalized)
    return candidates


def _ensure_topic_for_syllabus(course: Course, db: Session, topic_name: str, unit_name: str = None) -> Topic:
    existing = db.query(Topic).filter(Topic.course_id == course.id, Topic.name.ilike(topic_name)).first()
    if existing:
        return existing

    topic = Topic(
        course_id=course.id,
        name=topic_name,
        description=f"Syllabus topic aligned to {course.title}." if unit_name is None else f"Unit: {unit_name} · {topic_name}",
        order_index=(db.query(Topic).filter(Topic.course_id == course.id).count() + 1),
    )
    db.add(topic)
    db.flush()
    return topic


def _build_syllabus_summary(db: Session, course: Course, current_user: User, topic_names: List[str], unit_names: List[str] = None):
    unit_map = {name.strip(): name.strip() for name in (unit_names or []) if name and name.strip()}
    items = []

    for topic_name in topic_names:
        topic = db.query(Topic).filter(Topic.course_id == course.id, Topic.name.ilike(topic_name)).first()
        if topic is None:
            topic = _ensure_topic_for_syllabus(course, db, topic_name)

        mastery_record = db.query(LearnerMastery).filter(
            LearnerMastery.user_id == current_user.id,
            LearnerMastery.course_id == course.id,
            LearnerMastery.topic == topic_name,
        ).order_by(LearnerMastery.last_updated.desc()).first()

        mastery_score = float(mastery_record.mastery_score) if mastery_record else 0.0
        status = _status_from_mastery(mastery_score)
        confidence = None
        for unit_name in unit_map:
            normalized = unit_name.lower()
            if normalized in topic_name.lower() or topic_name.lower() in normalized:
                confidence = None
                break
        concepts = [c.name for c in db.query(Concept).filter(Concept.topic_id == topic.id).order_by(Concept.name).all()][:4]
        if not concepts:
            concepts = [topic_name]

        items.append({
            "name": topic_name,
            "unit": next((unit for unit in (unit_names or []) if unit and topic_name.lower().startswith(unit.lower()[:8])), None),
            "confidence": confidence,
            "status": status,
            "mastery": round(mastery_score, 3),
            "concepts": concepts,
        })

    return items

@router.get("/topics", response_model=List[TopicOut])
def get_course_topics(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Course belongs to another student.")

    topics = db.query(Topic).filter(Topic.course_id == course_id).order_by(Topic.order_index).all()

    results = []
    
    for t in topics:
        concepts = db.query(Concept).filter(Concept.topic_id == t.id).all()
        concept_outs = []
        for c in concepts:
            prereqs = json.loads(c.prerequisites) if c.prerequisites else []
            concept_outs.append(ConceptOut(
                id=c.id,
                topic_id=c.topic_id,
                name=c.name,
                description=c.description,
                prerequisites=prereqs,
                difficulty_level=c.difficulty_level
            ))
            
        mastery = db.query(LearnerMastery).filter(
            LearnerMastery.user_id == current_user.id,
            LearnerMastery.course_id == course_id,
            LearnerMastery.topic == t.name,
            LearnerMastery.total_attempts > 0
        ).first()
        mastery_val = mastery.mastery_score if mastery else 0.0

        results.append(TopicOut(
            id=t.id,
            course_id=t.course_id,
            name=t.name,
            description=t.description,
            order_index=t.order_index,
            parent_id=t.parent_id,
            concepts=concept_outs,
            mastery=mastery_val
        ))
        
    return results

@router.get("/knowledge-map", response_model=KnowledgeMapOut)
def get_knowledge_map(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = KnowledgeOrganizationAgent(db)
    raw_map = agent.get_knowledge_map(course_id)
    return raw_map


@router.get("/syllabus", response_model=SyllabusSnapshotOut)
def get_course_syllabus(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Course belongs to another student.")

    topic_names = [topic.name for topic in db.query(Topic).filter(Topic.course_id == course_id).order_by(Topic.order_index).all()]
    if not topic_names:
        topic_names = [
            "Problem Solving",
            "Core Concepts",
            "Practice and Revision",
        ]

    items = _build_syllabus_summary(db, course, current_user, topic_names)
    return SyllabusSnapshotOut(
        course_id=course_id,
        subject_name=course.title,
        subject_code=course.code,
        exam_date=None,
        topic_count=len(items),
        topics=[SyllabusItemOut(**item) for item in items],
    )


@router.post("/syllabus", response_model=SyllabusSnapshotOut)
def sync_course_syllabus(
    payload: SyllabusSyncRequest,
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.user_id and course.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Course belongs to another student.")

    extracted = _extract_syllabus_candidates(
        payload.syllabus_text or "",
        provided_topics=payload.topics,
        unit_names=payload.unit_names,
    )
    if not extracted:
        extracted = [
            "Foundations",
            "Core Principles",
            "Applied Practice",
            "Revision and Review",
        ]

    for topic_name in extracted:
        topic = _ensure_topic_for_syllabus(course, db, topic_name)
        concept_name = topic_name
        if not db.query(Concept).filter(Concept.topic_id == topic.id, Concept.name.ilike(concept_name)).first():
            db.add(Concept(
                topic_id=topic.id,
                course_id=course.id,
                name=concept_name,
                description=f"Syllabus concept for {topic_name}.",
                prerequisites=json.dumps([]),
                difficulty_level="Medium",
            ))

    db.commit()
    items = _build_syllabus_summary(db, course, current_user, extracted, payload.unit_names)
    return SyllabusSnapshotOut(
        course_id=course_id,
        subject_name=payload.subject_name or course.title,
        subject_code=payload.subject_code or course.code,
        exam_date=payload.exam_date,
        topic_count=len(items),
        topics=[SyllabusItemOut(**item) for item in items],
    )
