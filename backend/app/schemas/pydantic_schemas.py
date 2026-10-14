from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Auth & User ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")
    full_name: str
    role: Optional[str] = "student"

class UserLogin(BaseModel):
    email: str
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# --- Courses ---
class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    code: Optional[str] = None

class CourseOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    code: Optional[str] = None
    created_at: datetime
    materials_count: Optional[int] = 0
    topics_count: Optional[int] = 0
    mastery_avg: Optional[float] = 0.0
    class Config:
        from_attributes = True

# --- Materials ---
class MaterialOut(BaseModel):
    id: str
    course_id: str
    title: str
    file_type: str
    file_path: str
    file_size_bytes: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    chunks_count: Optional[int] = 0
    extracted_topics: Optional[List[str]] = []
    class Config:
        from_attributes = True


# --- Knowledge & Topics ---
class ConceptOut(BaseModel):
    id: str
    topic_id: str
    name: str
    description: Optional[str] = None
    prerequisites: List[str] = []
    difficulty_level: str = "Medium"
    class Config:
        from_attributes = True

class TopicOut(BaseModel):
    id: str
    course_id: str
    name: str
    description: Optional[str] = None
    order_index: int
    parent_id: Optional[str] = None
    concepts: List[ConceptOut] = []
    mastery: Optional[float] = 0.5
    class Config:
        from_attributes = True

class KnowledgeMapNode(BaseModel):
    id: str
    label: str
    type: str  # "topic" or "concept"
    topic: str
    mastery: float
    prerequisites: List[str] = []
    description: Optional[str] = None

class KnowledgeMapEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = "prerequisite"

class KnowledgeMapOut(BaseModel):
    nodes: List[KnowledgeMapNode]
    edges: List[KnowledgeMapEdge]

# --- Syllabus Intelligence ---
class SyllabusItemOut(BaseModel):
    name: str
    unit: Optional[str] = None
    confidence: Optional[int] = None
    status: str = "Not Started"
    mastery: float = 0.0
    concepts: List[str] = []
    class Config:
        from_attributes = True

class SyllabusSnapshotOut(BaseModel):
    course_id: str
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    exam_date: Optional[str] = None
    topic_count: int = 0
    topics: List[SyllabusItemOut] = []

class SyllabusSyncRequest(BaseModel):
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    exam_date: Optional[str] = None
    syllabus_text: Optional[str] = None
    unit_names: List[str] = []
    topics: List[str] = []
    confidence_by_topic: Dict[str, int] = {}

# --- Citations & Chat ---
class Citation(BaseModel):
    source_name: str
    material_type: str  # "pdf", "pptx", "video"
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    video_timestamp: Optional[str] = None
    topic: Optional[str] = None
    concept: Optional[str] = None
    snippet: str
    relevance_score: Optional[float] = None

# --- Study Guide ---
class StudySection(BaseModel):
    title: str
    content: str
    key_points: List[str] = []
    citations: List[Citation] = []

class StudyGuideOut(BaseModel):
    course_id: str
    material_id: Optional[str] = None
    material_title: Optional[str] = None
    title: str
    summary: str
    sections: List[StudySection]
    key_definitions: List[Dict[str, str]] = []
    revision_checklist: List[str] = []
    is_grounded: bool = True

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    topic_focus: Optional[str] = None
    material_id: Optional[str] = None

class MessageOut(BaseModel):
    id: str
    sender: str
    content: str
    citations: List[Citation] = []
    is_grounded: bool = True
    created_at: datetime
    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    conversation_id: str
    message: MessageOut

class ConversationOut(BaseModel):
    id: str
    course_id: str
    title: str
    created_at: datetime
    messages: List[MessageOut] = []
    class Config:
        from_attributes = True

# --- Assessments ---
class AssessmentGenerateRequest(BaseModel):
    topic: str
    difficulty: Optional[str] = "Medium"  # "Easy", "Medium", "Hard", "Adaptive"
    num_questions: Optional[int] = 4
    adaptive_mode: Optional[bool] = True

class QuestionOut(BaseModel):
    id: str
    question_text: str
    question_type: str
    options: List[str] = []
    difficulty: str
    topic: str
    concept: Optional[str] = None
    source_reference: Optional[str] = None
    # correct_answer & explanation omitted during test phase unless student submitted
    is_verified: bool = True

class AssessmentOut(BaseModel):
    id: str
    course_id: str
    topic: str
    difficulty: str
    total_questions: int
    questions: List[QuestionOut]
    created_at: datetime

class QuestionSubmission(BaseModel):
    question_id: str
    student_answer: str

class AssessmentSubmitRequest(BaseModel):
    submissions: List[QuestionSubmission]

class QuestionResultOut(BaseModel):
    question_id: str
    question_text: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    score: float
    explanation: str
    source_reference: Optional[str] = None
    misconception_detected: Optional[str] = None
    misconception_feedback: Optional[str] = None

class AssessmentResultOut(BaseModel):
    assessment_id: str
    total_questions: int
    correct_count: int
    score_percentage: float
    results: List[QuestionResultOut]
    updated_mastery: Dict[str, float]
    new_recommendations: List[str]

# --- Learner Modeling ---
class LearnerMasteryOut(BaseModel):
    topic: str
    concept: Optional[str] = None
    mastery_score: float
    total_attempts: int
    correct_attempts: int
    status: str  # "Weak (<40%)", "Developing (40-75%)", "Mastered (>75%)"
    last_updated: datetime

class MisconceptionOut(BaseModel):
    id: str
    topic: str
    concept: Optional[str] = None
    misconception_name: str
    description: str
    count: int
    resolved: bool
    last_detected_at: datetime

class RecommendationOut(BaseModel):
    id: str
    title: str
    description: str
    reason: str
    action_type: str
    target_topic: Optional[str] = None
    target_resource: Optional[str] = None
    priority: int
    is_completed: bool
    created_at: datetime

class StudyPlanDayOut(BaseModel):
    day: str
    focus_topic: str
    objective: str
    activities: List[str] = []
    estimated_minutes: int = 30
    priority: str = "High"

class StudyPlanOut(BaseModel):
    course_id: str
    overall_goal: str
    generated_at: datetime
    days: List[StudyPlanDayOut] = []

class LearnerOverviewOut(BaseModel):
    overall_mastery: float
    topics_mastery: List[LearnerMasteryOut]
    weak_topics: List[str]
    strong_topics: List[str]
    active_misconceptions: List[MisconceptionOut]
    recommendations: List[RecommendationOut]
    recent_activity_count: int

# --- Evaluation ---
class EvaluationMetric(BaseModel):
    name: str
    score: float
    target: float
    status: str
    description: str

class BenchmarkItemResult(BaseModel):
    id: str
    query: str
    expected_type: str  # "grounded" or "refusal"
    actual_response: str
    citations_returned: int
    grounding_status: str
    faithfulness_score: float
    answer_relevancy: float
    citation_accuracy: float
    passed: bool

class EvaluationRunOut(BaseModel):
    timestamp: datetime
    total_tests: int
    passed_tests: int
    overall_score: float
    metrics: List[EvaluationMetric]
    benchmark_results: List[BenchmarkItemResult]
