# LearnFlow AI
## Adaptive Multi-Agent Personal Tutor & Personalized Learning Platform

LearnFlow AI is an AI-powered adaptive learning platform that transforms multimodal course material such as PDFs, PPTX presentations, and lecture recordings into a structured, source-grounded learning environment.

It uses an **8-agent LangGraph architecture** to provide grounded tutoring, adaptive assessments, misconception diagnosis, real-time learner modeling, and personalized next-best learning actions.

---

# 1. Key Features

| Domain | Implemented Features |
|---|---|
| **Authentication & Security** | JWT-based authentication |
| | Secure password hashing using PBKDF2/Bcrypt |
| | Input validation and sanitized database queries |
| | Protected API endpoints |
| | No API keys exposed to frontend |
| **Multimodal Learning Material** | PDF textbook ingestion |
| | PPTX slide ingestion |
| | Lecture video transcript ingestion |
| | Exact source metadata preservation |
| | Page, slide, and video timestamp references |
| **AI Knowledge Organization** | Automatic topic extraction |
| | Subtopic and concept organization |
| | Prerequisite dependency graph |
| | Interactive knowledge map |
| **Grounded AI Tutor** | RAG-based question answering |
| | Strict source grounding |
| | Clickable source citations |
| | Source Viewer Modal |
| | Out-of-domain query refusal |
| | Hallucination-resistant responses |
| **Adaptive Assessment** | MCQ generation |
| | Problem-solving question generation |
| | Conceptual question generation |
| | Easy / Medium / Hard difficulty levels |
| | Mastery-aware question selection |
| **Question Verification** | Single-answer validation |
| | Question clarity verification |
| | Pedagogical quality checks |
| | Source alignment verification |
| | Automatic Reject → Regenerate workflow |
| **Misconception Analysis** | Incorrect-answer analysis |
| | Root conceptual misunderstanding detection |
| | Concept-level remediation |
| | Personalized feedback |
| **Learner Modeling** | Real-time topic mastery tracking |
| | Difficulty calibration |
| | Mistake penalties |
| | Mastery score range: 0.05–0.99 |
| | Learner analytics |
| **Personalization** | Next Best Action recommendations |
| | Foundational review recommendations |
| | Intermediate practice recommendations |
| | Challenge quiz recommendations |
| | Explicit pedagogical "WHY" explanations |
| **Evaluation & Benchmarking** | RAG benchmark suite |
| | Faithfulness evaluation |
| | Relevancy evaluation |
| | Citation precision evaluation |
| | Refusal reliability evaluation |
| | Automated agent testing |

---

# 2. Architecture Overview

## System Data Flow

```text
PDF / PPTX / VIDEO
        │
        ▼
┌─────────────────────────────┐
│ Agent 1                     │
│ Multimodal Ingestion        │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Agent 2                     │
│ Knowledge Organization      │
└──────────────┬──────────────┘
               ▼
      Knowledge Base
               │
               ▼
┌─────────────────────────────┐
│ Agent 3                     │
│ Grounded AI Tutor / RAG     │
└──────────────┬──────────────┘
               │
               ▼
        Student Interaction
               │
               ▼
┌─────────────────────────────┐
│ Agent 4                     │
│ Assessment Generation       │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Agent 5                     │
│ Question Verification       │
└──────────────┬──────────────┘
               │
        Reject → Regenerate
               │
               ▼
        Student Answer
               │
               ▼
┌─────────────────────────────┐
│ Agent 6                     │
│ Misconception Analysis      │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Agent 7                     │
│ Learner Model               │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ Agent 8                     │
│ Personalization             │
└──────────────┬──────────────┘
               │
               ▼
       Next Best Action
               │
               └──────────► Repeat & Master
```

## Adaptive Learning Loop

```text
Learn
  ↓
Practice
  ↓
Answer
  ↓
Diagnose
  ↓
Update Mastery
  ↓
Personalize
  ↓
Learn Again
```

---

# 3. The 8 AI Agents

### Agent 1 — Multimodal Ingestion Agent

Processes:

- Text-based PDF textbooks (scanned PDFs require OCR; OCR is not configured)
- DOCX documents, including paragraphs and tables
- TXT and Markdown notes
- PPTX presentations
- Lecture video transcripts from a matching VTT sidecar (automatic audio/video transcription is not configured)

Preserves exact source metadata including:

- source name
- page number
- slide number
- video timestamp

### Agent 2 — Knowledge Organization Agent

Converts unstructured learning material into:

```text
Course
 └── Topic
      └── Subtopic
           └── Concept
                └── Prerequisites
```

It also builds the prerequisite dependency graph used by the tutor and personalization system.

### Agent 3 — Grounded Tutor Agent

Provides source-grounded answers using RAG.

Features include:

- Semantic retrieval
- Source verification
- Clickable citations
- Source Viewer
- Out-of-domain refusal

Example:

```text
[Algorithms_Textbook.pdf — Page 42]
[Lecture_03_Searching.mp4 — 14:22]
```

### Agent 4 — Assessment Generation Agent

Generates:

- MCQs
- Programming/problem-solving questions
- Conceptual questions

Questions are calibrated according to:

- Topic
- Learner mastery
- Difficulty
- Previous performance

### Agent 5 — Question Verification Agent

Before a question reaches the learner, the agent verifies:

- Single correct answer
- Clarity
- Source alignment
- Pedagogical quality

Invalid questions enter:

```text
Reject → Regenerate → Verify → Present
```

### Agent 6 — Misconception Analysis Agent

Analyzes incorrect answers and identifies the underlying conceptual mistake.

Instead of simply saying:

> "Wrong answer."

It identifies the likely misconception and provides targeted remediation.

### Agent 7 — Learner Model Agent

Maintains a real-time learner mastery model.

Mastery scores are maintained between:

```text
0.05 ≤ Mastery ≤ 0.99
```

The model considers:

- Previous performance
- Question difficulty
- Mistakes
- Topic-level understanding

### Agent 8 — Personalization Agent

Uses the learner model to generate **Next Best Actions**.

Possible recommendations:

```text
Foundational Review
        ↓
Intermediate Practice
        ↓
Challenge Quiz
```

Each recommendation includes a pedagogical explanation of **WHY** it was selected.

---

# 4. Technology Stack

## Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- Lucide Icons
- Recharts
- React Router v6
- Axios

## Backend

- Python 3.11+
- FastAPI
- SQLAlchemy
- Pydantic v2
- Python-Jose
- Passlib

## AI / ML

- LangGraph
- Multi-Agent StateGraph
- RAG
- TF-IDF / Subword embeddings
- Cosine Similarity Vector Search
- OpenAI Embeddings support
- Ollama support

## Database

- SQLite — default zero-setup database
- PostgreSQL
- pgvector

## Deployment

- Docker
- Docker Compose

---

# 5. Folder Structure

```text
learnflow-ai/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   ├── agents/
│   │   │   ├── ingestion_agent.py
│   │   │   ├── knowledge_agent.py
│   │   │   ├── tutor_agent.py
│   │   │   ├── assessment_agent.py
│   │   │   ├── verification_agent.py
│   │   │   ├── misconception_agent.py
│   │   │   ├── learner_model_agent.py
│   │   │   └── personalization_agent.py
│   │   └── graph/
│   │       └── learning_graph.py
│   │
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── start.ps1
└── README.md
```

---

# 6. Database Structure

## 1. Users

Stores learner authentication and profile information.

```text
id
email
password_hash
name
created_at
last_login
```

## 2. Courses

Stores course information.

```text
id
name
description
created_at
```

## 3. Learning Materials

Stores uploaded and indexed learning content.

```text
id
course_id
source_name
source_type
page_number
slide_number
video_timestamp
content
embedding
```

## 4. Topics

Stores the structured knowledge hierarchy.

```text
id
course_id
topic_name
subtopic_name
concept_name
prerequisites
```

## 5. Questions

Stores generated and verified assessments.

```text
id
topic_id
question
question_type
difficulty
options
correct_answer
source_reference
verification_status
```

## 6. Learner Progress

Stores learner mastery information.

```text
id
user_id
topic_id
mastery_score
attempts
correct_answers
incorrect_answers
updated_at
```

## 7. Misconceptions

Stores diagnosed conceptual misunderstandings.

```text
id
user_id
topic_id
question_id
misconception
diagnosis
remediation
created_at
```

## 8. Recommendations

Stores personalized Next Best Actions.

```text
id
user_id
topic_id
action_type
recommendation
reason
created_at
```

---

# 7. Installation Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm
- Optional PostgreSQL + pgvector
- Optional Ollama

## Backend Setup

```bash
cd backend

pip install -r requirements.txt

python -m app.database.init_db

python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```text
http://localhost:5173
```

## One-Command Windows Setup

```powershell
.\start.ps1
```

---

# 8. Demo Credentials

```text
Email: demo@learnflow.ai
Password: demo1234
```

The application also provides a **Quick Demo Login** option.

---

# 9. Testing & Evaluation

LearnFlow AI includes automated tests covering:

- RAG retrieval
- Out-of-domain refusal
- Question generation
- Question verification
- Misconception diagnosis
- Learner mastery updates

Run tests with:

```bash
cd backend
python -m pytest tests/
```

The project also includes an evaluation dashboard for measuring:

- Faithfulness
- Relevancy
- Citation Precision
- Refusal Reliability

Evaluation can be triggered through:

```bash
curl -X POST http://localhost:8000/api/evaluation/run
```

---

# 10. User Learning Flow

## Login

Student enters the platform using secure authentication.

## Dashboard

The learner can see:

- Overall mastery
- Active course
- Topic progress
- Personalized recommendations

Example:

```text
Overall Mastery: 65%

Course:
Data Structures & Algorithms
```

## Materials

Students can explore indexed:

- Textbooks
- Slide decks
- Lecture recordings

with exact source references.

## Knowledge Map

Students can explore relationships between:

```text
Topics → Concepts → Prerequisites
```

## AI Tutor

Students can ask questions such as:

```text
Explain binary search and its prerequisite.
```

The tutor responds using grounded course sources.

## Adaptive Assessment

The learner generates a quiz based on a selected topic.

Questions are adapted to the learner's current mastery.

## Misconception Diagnosis

If the learner answers incorrectly, the system identifies the underlying conceptual misunderstanding and provides remediation.

## Personalized Next

The learner receives the next recommended learning action based on their updated mastery.

## Evaluation

The evaluation dashboard allows the system's RAG and refusal performance to be benchmarked.

---

# 11. API Endpoints

## Authentication

```text
POST /api/auth/login
```

Authenticates the learner and returns a JWT token.

## Courses

```text
GET /api/courses
GET /api/courses/{id}
```

## Learning Materials

```text
POST /api/materials/upload
GET /api/materials
GET /api/materials/{id}
```

## Knowledge Map

```text
GET /api/knowledge/topics
GET /api/knowledge/graph
```

## AI Tutor

```text
POST /api/tutor/query
```

Processes learner questions using the grounded RAG tutor.

## Assessment

```text
POST /api/assessment/generate
POST /api/assessment/submit
```

## Learner Analytics

```text
GET /api/learner/mastery
GET /api/learner/analytics
```

## Personalization

```text
GET /api/personalization/next
```

## Evaluation

```text
POST /api/evaluation/run
GET /api/evaluation/results
```

---

# 12. Interface

## Login Page

Quick Demo Login and secure learner authentication.

## Dashboard

Displays:

- Overall mastery
- Course progress
- Topic performance
- Next Best Actions

## Materials

Displays indexed PDFs, slides, and lecture recordings with source metadata.

## Knowledge Map

Interactive visualization of topics, concepts, and prerequisites.

## Grounded AI Tutor

Chat interface with:

- Source citations
- Clickable references
- Source Viewer Modal
- Out-of-domain refusal

## Assessment

Adaptive quiz interface with difficulty-aware questions.

## Learner Analytics

Displays topic mastery and learning progress.

## Personalized Next

Displays recommended actions with pedagogical **WHY** explanations.

## Evaluation Dashboard

Displays RAG benchmark results including:

- Faithfulness
- Relevancy
- Citation Precision
- Refusal Reliability

---

# 13. Security Features

### JWT Authentication

Protected APIs require a valid bearer token.

### Password Security

Passwords are protected using PBKDF2/Bcrypt hashing.

### Input Validation

Pydantic schemas validate API inputs.

### SQL Security

SQLAlchemy ORM is used for database interaction and sanitized queries.

### API Key Protection

No API keys are committed or exposed to the frontend client.

### Source Grounding

Tutor responses are constrained to the indexed learning material.

### Out-of-Domain Refusal

The tutor refuses unrelated questions instead of generating unsupported answers.

---

# 14. Future Enhancements

- Spaced repetition scheduling
- Voice-based AI tutoring
- Real-time lecture understanding
- Advanced multimodal video analysis
- More sophisticated learner modeling
- Collaborative learning
- Teacher analytics dashboard
- Automatic course generation
- Mobile application
- Multi-language tutoring
- Personalized study schedules
- Long-term learning memory

---

# 15. Core Learning Philosophy

LearnFlow AI is designed around a simple principle:

**Don't just answer the learner's question. Understand what they know, identify what they don't know, and decide what they should learn next.**

The system continuously follows:

```text
CONTENT
   ↓
UNDERSTANDING
   ↓
PRACTICE
   ↓
ASSESSMENT
   ↓
MISCONCEPTION
   ↓
MASTERY UPDATE
   ↓
PERSONALIZATION
   ↓
NEXT BEST ACTION
   ↓
MASTER
```

This creates a continuous adaptive learning loop rather than a conventional chatbot experience.
