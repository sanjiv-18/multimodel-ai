import axios from 'axios';
import {
  User, Course, Material, Topic, Assessment, AssessmentResult,
  LearnerOverview, EvaluationResults, ChatResponse, Conversation, StudyGuide,
  SyllabusSnapshot, StudyPlan
} from '../types';


const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set Auth Token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('learnflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (email: string, password: string): Promise<{ access_token: string; user: User }> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (email: string, password: string, full_name: string): Promise<{ access_token: string; user: User }> => {
    const res = await api.post('/auth/register', { email, password, full_name });
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const courseService = {
  list: async (): Promise<Course[]> => {
    const res = await api.get('/courses');
    return res.data;
  },
  get: async (courseId: string): Promise<Course> => {
    const res = await api.get(`/courses/${courseId}`);
    return res.data;
  },
  create: async (title: string, description?: string, code?: string): Promise<Course> => {
    const res = await api.post('/courses', { title, description, code });
    return res.data;
  },
  delete: async (courseId: string): Promise<{ status: string }> => {
    const res = await api.delete(`/courses/${courseId}`);
    return res.data;
  },
};

export const materialService = {
  list: async (courseId: string): Promise<Material[]> => {
    const res = await api.get(`/courses/${courseId}/materials`);
    return res.data;
  },
  upload: async (courseId: string, file: File, title?: string): Promise<Material> => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    const res = await api.post(`/courses/${courseId}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getStatus: async (materialId: string) => {
    const res = await api.get(`/materials/${materialId}/status`);
    return res.data;
  },
  delete: async (materialId: string): Promise<{ status: string }> => {
    const res = await api.delete(`/materials/${materialId}`);
    return res.data;
  },
  getStudyGuide: async (courseId: string, materialId?: string): Promise<StudyGuide> => {
    const res = await api.get(`/courses/${courseId}/study-guide`, {
      params: materialId ? { material_id: materialId } : {},
    });
    return res.data;
  },
};



export const knowledgeService = {
  getTopics: async (courseId: string): Promise<Topic[]> => {
    const res = await api.get(`/courses/${courseId}/topics`);
    return res.data;
  },
  getKnowledgeMap: async (courseId: string) => {
    const res = await api.get(`/courses/${courseId}/knowledge-map`);
    return res.data;
  },
  getSyllabus: async (courseId: string): Promise<SyllabusSnapshot> => {
    const res = await api.get(`/courses/${courseId}/syllabus`);
    return res.data;
  },
  syncSyllabus: async (courseId: string, payload: {
    subject_name?: string;
    subject_code?: string;
    exam_date?: string;
    syllabus_text?: string;
    unit_names?: string[];
    topics?: string[];
    confidence_by_topic?: Record<string, number>;
  }): Promise<SyllabusSnapshot> => {
    const res = await api.post(`/courses/${courseId}/syllabus`, payload);
    return res.data;
  },
};

export const tutorService = {
  chat: async (courseId: string, message: string, conversationId?: string, materialId?: string): Promise<ChatResponse> => {
    const res = await api.post(`/courses/${courseId}/chat`, {
      message,
      conversation_id: conversationId,
      material_id: materialId,
    });
    return res.data;
  },
  listConversations: async (courseId?: string): Promise<Conversation[]> => {
    const res = await api.get('/conversations', { params: { course_id: courseId } });
    return res.data;
  },
};

export const assessmentService = {
  generate: async (
    courseId: string,
    topic: string,
    difficulty: string = 'Adaptive',
    numQuestions: number = 4
  ): Promise<Assessment> => {
    const res = await api.post(`/courses/${courseId}/assessments/generate`, {
      topic,
      difficulty,
      num_questions: numQuestions,
      adaptive_mode: true,
    });
    return res.data;
  },
  get: async (assessmentId: string): Promise<Assessment> => {
    const res = await api.get(`/assessments/${assessmentId}`);
    return res.data;
  },
  submit: async (
    assessmentId: string,
    submissions: { question_id: string; student_answer: string }[]
  ): Promise<AssessmentResult> => {
    const res = await api.post(`/assessments/${assessmentId}/submit`, { submissions });
    return res.data;
  },
};

export const learnerService = {
  getOverview: async (courseId?: string): Promise<LearnerOverview> => {
    const res = await api.get('/students/me/overview', { params: { course_id: courseId } });
    return res.data;
  },
  getMastery: async (courseId?: string) => {
    const res = await api.get('/students/me/mastery', { params: { course_id: courseId } });
    return res.data;
  },
  getMisconceptions: async (courseId?: string) => {
    const res = await api.get('/students/me/misconceptions', { params: { course_id: courseId } });
    return res.data;
  },
  getRecommendations: async (courseId?: string) => {
    const res = await api.get('/students/me/recommendations', { params: { course_id: courseId } });
    return res.data;
  },
  getStudyPlan: async (courseId?: string): Promise<StudyPlan> => {
    const res = await api.get('/students/me/study-plan', { params: { course_id: courseId } });
    return res.data;
  },
};

export const evaluationService = {
  run: async (courseId?: string): Promise<EvaluationResults> => {
    const res = await api.post('/evaluation/run', null, { params: { course_id: courseId } });
    return res.data;
  },
  getResults: async (courseId?: string): Promise<EvaluationResults> => {
    const res = await api.get('/evaluation/results', { params: { course_id: courseId } });
    return res.data;
  },
};
