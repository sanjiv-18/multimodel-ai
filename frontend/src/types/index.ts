export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  code?: string;
  created_at: string;
  materials_count: number;
  topics_count: number;
  mastery_avg: number;
}

export interface Material {
  id: string;
  course_id: string;
  title: string;
  file_type: 'pdf' | 'docx' | 'text' | 'pptx' | 'video';
  file_path: string;
  file_size_bytes: number;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  error_message?: string;
  created_at: string;
  chunks_count: number;
  extracted_topics?: string[];
}

export interface StudySection {
  title: string;
  content: string;
  key_points: string[];
  citations: Citation[];
}

export interface StudyGuide {
  course_id: string;
  material_id?: string;
  material_title?: string;
  title: string;
  summary: string;
  sections: StudySection[];
  key_definitions: { term: string; definition: string }[];
  revision_checklist: string[];
  is_grounded: boolean;
}


export interface Concept {
  id: string;
  topic_id: string;
  name: string;
  description?: string;
  prerequisites: string[];
  difficulty_level: string;
}

export interface Topic {
  id: string;
  course_id: string;
  name: string;
  description?: string;
  order_index: number;
  parent_id?: string;
  concepts: Concept[];
  mastery: number;
}

export interface SyllabusItem {
  name: string;
  unit?: string;
  confidence?: number;
  status: string;
  mastery: number;
  concepts: string[];
}

export interface SyllabusSnapshot {
  course_id: string;
  subject_name?: string;
  subject_code?: string;
  exam_date?: string;
  topic_count: number;
  topics: SyllabusItem[];
}

export interface Citation {
  source_name: string;
  material_type: 'pdf' | 'docx' | 'text' | 'pptx' | 'video';
  page_number?: number;
  slide_number?: number;
  video_timestamp?: string;
  topic?: string;
  concept?: string;
  snippet: string;
  relevance_score?: number;
}

export interface Message {
  id: string;
  sender: 'user' | 'tutor';
  content: string;
  citations: Citation[];
  is_grounded: boolean;
  created_at: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
}

export interface Conversation {
  id: string;
  course_id: string;
  title: string;
  created_at: string;
  messages: Message[];
}

export interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  difficulty: string;
  topic: string;
  concept?: string;
  source_reference?: string;
  is_verified: boolean;
}

export interface Assessment {
  id: string;
  course_id: string;
  topic: string;
  difficulty: string;
  total_questions: number;
  questions: Question[];
  created_at: string;
}

export interface QuestionResult {
  question_id: string;
  question_text: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  score: number;
  explanation: string;
  source_reference?: string;
  misconception_detected?: string;
  misconception_feedback?: string;
}

export interface AssessmentResult {
  assessment_id: string;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  results: QuestionResult[];
  updated_mastery: Record<string, number>;
  new_recommendations: string[];
}

export interface LearnerMastery {
  topic: string;
  concept?: string;
  mastery_score: number;
  total_attempts: number;
  correct_attempts: number;
  status: string;
  last_updated: string;
}

export interface Misconception {
  id: string;
  topic: string;
  concept?: string;
  misconception_name: string;
  description: string;
  count: number;
  resolved: boolean;
  last_detected_at: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  reason: string;
  action_type: string;
  target_topic?: string;
  target_resource?: string;
  priority: number;
  is_completed: boolean;
  created_at: string;
}

export interface StudyPlanDay {
  day: string;
  focus_topic: string;
  objective: string;
  activities: string[];
  estimated_minutes: number;
  priority: string;
}

export interface StudyPlan {
  course_id: string;
  overall_goal: string;
  generated_at: string;
  days: StudyPlanDay[];
}

export interface LearnerOverview {
  overall_mastery: number;
  topics_mastery: LearnerMastery[];
  weak_topics: string[];
  strong_topics: string[];
  active_misconceptions: Misconception[];
  recommendations: Recommendation[];
  recent_activity_count: number;
}

export interface EvaluationMetric {
  name: string;
  score: number;
  target: number;
  status: string;
  description: string;
}

export interface BenchmarkItemResult {
  id: string;
  query: string;
  expected_type: string;
  actual_response: string;
  citations_returned: number;
  grounding_status: string;
  faithfulness_score: number;
  answer_relevancy: number;
  citation_accuracy: number;
  passed: boolean;
}

export interface EvaluationResults {
  timestamp: string;
  total_tests: number;
  passed_tests: number;
  overall_score: number;
  metrics: EvaluationMetric[];
  benchmark_results: BenchmarkItemResult[];
}
