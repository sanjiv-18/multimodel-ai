from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.db_models import LearnerMastery, Misconception, Recommendation, Course, User
from app.schemas.pydantic_schemas import (
    LearnerMasteryOut, MisconceptionOut, RecommendationOut, LearnerOverviewOut,
    StudyPlanOut, StudyPlanDayOut
)
from app.agents.learner_agent import LearnerModelAgent
from app.agents.personalization_agent import PersonalizationAgent
from app.api.auth import get_current_user

router = APIRouter(prefix="/students/me", tags=["Learner Modeling & Analytics"])

@router.get("/mastery", response_model=List[LearnerMasteryOut])
def get_student_mastery(
    course_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(LearnerMastery).filter(LearnerMastery.user_id == current_user.id)
    if course_id:
        query = query.filter(LearnerMastery.course_id == course_id)
        
    records = query.all()
    results = []
    for r in records:
        status_lbl = "Not started"
        if r.total_attempts > 0:
            if r.mastery_score < 0.40:
                status_lbl = "Weak (<40%)"
            elif r.mastery_score >= 0.75:
                status_lbl = "Mastered (>75%)"
            else:
                status_lbl = "Developing (40-75%)"

        results.append(LearnerMasteryOut(
            topic=r.topic,
            concept=r.concept,
            mastery_score=r.mastery_score if r.total_attempts > 0 else 0.0,
            total_attempts=r.total_attempts,
            correct_attempts=r.correct_attempts,
            status=status_lbl,
            last_updated=r.last_updated
        ))
    return results

@router.get("/misconceptions", response_model=List[MisconceptionOut])
def get_student_misconceptions(
    course_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Misconception).filter(Misconception.user_id == current_user.id)
    if course_id:
        query = query.filter(Misconception.course_id == course_id)
        
    records = query.order_by(Misconception.last_detected_at.desc()).all()
    results = []
    for r in records:
        results.append(MisconceptionOut(
            id=r.id,
            topic=r.topic,
            concept=r.concept,
            misconception_name=r.misconception_name,
            description=r.description,
            count=r.count,
            resolved=r.resolved,
            last_detected_at=r.last_detected_at
        ))
    return results

@router.get("/recommendations", response_model=List[RecommendationOut])
def get_student_recommendations(
    course_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If course_id provided, ensure fresh recommendations
    if course_id:
        p_agent = PersonalizationAgent(db)
        p_agent.generate_recommendations(current_user.id, course_id)

    query = db.query(Recommendation).filter(Recommendation.user_id == current_user.id)
    if course_id:
        query = query.filter(Recommendation.course_id == course_id)
        
    records = query.order_by(Recommendation.priority.asc()).all()
    results = []
    for r in records:
        results.append(RecommendationOut(
            id=r.id,
            title=r.title,
            description=r.description,
            reason=r.reason,
            action_type=r.action_type,
            target_topic=r.target_topic,
            target_resource=r.target_resource,
            priority=r.priority,
            is_completed=r.is_completed,
            created_at=r.created_at
        ))
    return results

@router.get("/study-plan", response_model=StudyPlanOut)
def get_student_study_plan(
    course_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_course_id = course_id
    if not target_course_id:
        user_first_course = db.query(Course).filter(
            (Course.user_id == current_user.id) | (Course.user_id == None)
        ).first()
        target_course_id = user_first_course.id if user_first_course else None

    if not target_course_id:
        return StudyPlanOut(
            course_id="",
            overall_goal="Upload course materials and start your first practice session to unlock a personalized study plan.",
            generated_at=datetime.utcnow(),
            days=[
                StudyPlanDayOut(
                    day="Day 1",
                    focus_topic="Course onboarding",
                    objective="Add your first notes or slides and build the base learning map.",
                    activities=[
                        "Upload a syllabus, note set, or textbook chapter.",
                        "Ask the tutor to highlight the most important concepts.",
                        "Start with a short diagnostic practice quiz."
                    ],
                    estimated_minutes=25,
                    priority="High"
                )
            ]
        )

    learner_agent = LearnerModelAgent(db)
    profile = learner_agent.get_learner_profile(current_user.id, target_course_id)

    recs = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id,
        Recommendation.course_id == target_course_id
    ).order_by(Recommendation.priority.asc()).all()

    if not recs:
        p_agent = PersonalizationAgent(db)
        recs = p_agent.generate_recommendations(current_user.id, target_course_id)

    focus_topics = []
    seen = set()

    for topic in profile["weak_topics"]:
        if topic and topic not in seen:
            focus_topics.append(topic)
            seen.add(topic)

    for rec in recs[:5]:
        topic = rec.target_topic
        if topic and topic not in seen:
            focus_topics.append(topic)
            seen.add(topic)

    if not focus_topics:
        ranked = sorted(profile["topics_mastery"], key=lambda t: (t["mastery_score"], t["total_attempts"]))
        for topic in ranked[:5]:
            name = topic.get("topic")
            if name and name not in seen:
                focus_topics.append(name)
                seen.add(name)

    if not focus_topics:
        focus_topics = ["Course fundamentals"]

    days = []
    for idx, topic in enumerate(focus_topics[:5], start=1):
        mastery = next((item["mastery_score"] for item in profile["topics_mastery"] if item.get("topic") == topic), 0.0)
        if mastery < 0.40:
            objective = f"Rebuild the core ideas in {topic} and fix weak points before moving ahead."
            priority = "High"
        elif mastery < 0.75:
            objective = f"Strengthen your understanding in {topic} with targeted practice and review."
            priority = "Medium"
        else:
            objective = f"Consolidate {topic} with applied questions and quick retrieval checks."
            priority = "Medium"

        activities = [
            f"Review the most relevant notes and examples for {topic}.",
            f"Complete 3-5 short practice questions focused on {topic}.",
            f"Ask the tutor to explain one difficult step or misconception in plain language."
        ]

        days.append(StudyPlanDayOut(
            day=f"Day {idx}",
            focus_topic=topic,
            objective=objective,
            activities=activities,
            estimated_minutes=30 + (idx * 5),
            priority=priority
        ))

    return StudyPlanOut(
        course_id=target_course_id,
        overall_goal="Follow the next few study blocks to strengthen your weakest concepts and convert them into reliable understanding.",
        generated_at=datetime.utcnow(),
        days=days
    )


@router.get("/overview", response_model=LearnerOverviewOut)
def get_learner_overview(
    course_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_course_id = course_id
    if not target_course_id:
        user_first_course = db.query(Course).filter(
            (Course.user_id == current_user.id) | (Course.user_id == None)
        ).first()
        target_course_id = user_first_course.id if user_first_course else None

    if not target_course_id:
        # Honest empty state for user with no courses
        return LearnerOverviewOut(
            overall_mastery=0.0,
            topics_mastery=[],
            weak_topics=[],
            strong_topics=[],
            active_misconceptions=[],
            recommendations=[],
            recent_activity_count=0
        )

    agent = LearnerModelAgent(db)
    profile = agent.get_learner_profile(current_user.id, target_course_id)

    # Get recommendations
    recs = db.query(Recommendation).filter(
        Recommendation.user_id == current_user.id,
        Recommendation.course_id == target_course_id
    ).order_by(Recommendation.priority.asc()).all()

    if not recs:
        p_agent = PersonalizationAgent(db)
        recs = p_agent.generate_recommendations(current_user.id, target_course_id)

    rec_outs = [
        RecommendationOut(
            id=r.id,
            title=r.title,
            description=r.description,
            reason=r.reason,
            action_type=r.action_type,
            target_topic=r.target_topic,
            target_resource=r.target_resource,
            priority=r.priority,
            is_completed=r.is_completed,
            created_at=r.created_at
        )
        for r in recs
    ]

    misc_outs = [
        MisconceptionOut(
            id=m.id,
            topic=m.topic,
            concept=m.concept,
            misconception_name=m.misconception_name,
            description=m.description,
            count=m.count,
            resolved=m.resolved,
            last_detected_at=m.last_detected_at
        )
        for m in profile["active_misconceptions"]
    ]

    return LearnerOverviewOut(
        overall_mastery=profile["overall_mastery"],
        topics_mastery=[LearnerMasteryOut(**t) for t in profile["topics_mastery"]],
        weak_topics=profile["weak_topics"],
        strong_topics=profile["strong_topics"],
        active_misconceptions=misc_outs,
        recommendations=rec_outs,
        recent_activity_count=profile["recent_activity_count"]
    )
