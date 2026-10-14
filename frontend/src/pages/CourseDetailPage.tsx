import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseService, materialService, knowledgeService, learnerService } from '../services/api';
import { Course, Material, Topic, LearnerOverview, SyllabusSnapshot } from '../types';
import {
  BookOpen, UploadCloud, MessageSquare, HelpCircle, BarChart3,
  FileText, Presentation, Video, CheckCircle2, Plus,
  FolderPlus, X, RefreshCw, Trash2, PenTool
} from 'lucide-react';

export const CourseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'topics' | 'syllabus'>('overview');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusSnapshot | null>(null);
  const [overview, setOverview] = useState<LearnerOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // New Course Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCode, setNewCode] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [creatingCourse, setCreatingCourse] = useState<boolean>(false);

  // Upload Material State
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCourses = async () => {
    try {
      const cList = await courseService.list();
      setCourses(cList);
      if (cList.length > 0) {
        const cId = selectedCourseId && cList.some(c => c.id === selectedCourseId)
          ? selectedCourseId
          : cList[0].id;
        setSelectedCourseId(cId);
        await loadCourseDetails(cId);
      } else {
        setMaterials([]);
        setTopics([]);
        setOverview(null);
      }
    } catch (err) {
      console.error('Error loading courses', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCourseDetails = async (courseId: string) => {
    try {
      const [mats, tops, oView, syllabusSnapshot] = await Promise.all([
        materialService.list(courseId),
        knowledgeService.getTopics(courseId),
        learnerService.getOverview(courseId),
        knowledgeService.getSyllabus(courseId).catch(() => null),
      ]);
      setMaterials(mats);
      setTopics(tops);
      setOverview(oView);
      setSyllabus(syllabusSnapshot);
    } catch (err) {
      console.error('Error loading course details', err);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleSelectCourse = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoading(true);
    await loadCourseDetails(courseId);
    setLoading(false);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreatingCourse(true);
    try {
      const created = await courseService.create(newTitle.trim(), newDescription.trim(), newCode.trim());
      setShowCreateModal(false);
      setNewTitle('');
      setNewCode('');
      setNewDescription('');
      await loadCourses();
      setSelectedCourseId(created.id);
    } catch (err) {
      console.error('Failed to create course', err);
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedCourseId) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const uploaded = await materialService.upload(selectedCourseId, file, file.name);
      await loadCourseDetails(selectedCourseId);
      if (uploaded.status !== 'completed' || uploaded.chunks_count < 1) {
        window.alert(uploaded.error_message || `Could not extract readable study text from "${uploaded.title}".`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Failed to upload material', err);
      window.alert((err as any)?.response?.data?.detail || 'Could not upload or process this document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string, courseTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete course "${courseTitle}"? All associated materials, indexed chunks, and progress records will be permanently removed.`)) {
      return;
    }
    try {
      await courseService.delete(courseId);
      setSelectedCourseId('');
      await loadCourses();
    } catch (err) {
      console.error('Failed to delete course', err);
      alert('Could not delete course. Please try again.');
    }
  };

  const handleDeleteMaterial = async (materialId: string, materialTitle: string) => {
    if (!window.confirm(`Delete document "${materialTitle}"? Its extracted chunks and retrieval indexes will be removed immediately.`)) {
      return;
    }
    try {
      await materialService.delete(materialId);
      if (selectedCourseId) {
        await loadCourseDetails(selectedCourseId);
      }
    } catch (err) {
      console.error('Failed to delete material', err);
      alert('Could not delete material. Please try again.');
    }
  };


  if (loading && courses.length === 0) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header & Course Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Courses</h1>
          <p className="text-xs text-slate-500">
            Manage your courses, upload lecture notes, and inspect extracted knowledge topics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {courses.length > 1 && (
            <select
              value={selectedCourseId}
              onChange={(e) => handleSelectCourse(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ''}{c.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Course
          </button>
        </div>
      </div>

      {/* If No Courses Exist */}
      {courses.length === 0 && (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">No Courses Added Yet</h3>
            <p className="text-xs text-slate-500">
              Create your first course to begin uploading lecture slides, notes, and study documents.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create First Course
          </button>
        </div>
      )}

      {/* Active Course View */}
      {currentCourse && (
        <div className="space-y-6">
          {/* Course Card Header */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {currentCourse.code && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {currentCourse.code}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {materials.length} Materials • {topics.length} Topics
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{currentCourse.title}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.mp4,.mkv,.avi,.mov,.mp3,.wav"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Ingesting Material...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" /> Ingest Notes / Slides
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteCourse(currentCourse.id, currentCourse.title)}
                  title="Delete Course"
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('materials')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'materials'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                Materials ({materials.length})
              </button>
              <button
                onClick={() => setActiveTab('topics')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'topics'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                Extracted Topics ({topics.length})
              </button>
              <button
                onClick={() => setActiveTab('syllabus')}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'syllabus'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                Syllabus Intelligence
              </button>
            </div>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Course Description</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {currentCourse.description || 'No description provided.'}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => navigate('/tutor')}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group space-y-2"
                  >
                    <MessageSquare className="w-5 h-5 text-indigo-600 group-hover:scale-105 transition-transform" />
                    <h4 className="font-bold text-sm text-slate-900">Grounded AI Tutor</h4>
                    <p className="text-xs text-slate-500">
                      Ask doubts backed by exact page/slide citations from this course.
                    </p>
                  </div>

                  <div
                    onClick={() => navigate('/practice')}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group space-y-2"
                  >
                    <HelpCircle className="w-5 h-5 text-amber-500 group-hover:scale-105 transition-transform" />
                    <h4 className="font-bold text-sm text-slate-900">Adaptive Practice</h4>
                    <p className="text-xs text-slate-500">
                      Take quizzes dynamically generated from extracted course topics.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Topics Summary */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Topic Mastery
                </h3>
                {topics.length > 0 ? (
                  <div className="space-y-3">
                    {topics.map((t) => (
                      <div key={t.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 truncate">{t.name}</span>
                          <span className="font-mono text-slate-500 text-[11px]">
                            {Math.round((t.mastery || 0) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${Math.round((t.mastery || 0) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    No topics extracted yet. Upload notes to index topics.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Materials List */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              {materials.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {materials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                          {mat.file_type === 'pdf' && <FileText className="w-5 h-5 text-rose-500" />}
                          {mat.file_type === 'pptx' && <Presentation className="w-5 h-5 text-amber-500" />}
                          {mat.file_type === 'video' && <Video className="w-5 h-5 text-sky-500" />}
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {mat.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900 truncate">{mat.title}</h4>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {mat.chunks_count} semantic chunks indexed • {(mat.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                        </p>
                        {mat.extracted_topics && mat.extracted_topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {mat.extracted_topics.slice(0, 3).map((top, idx) => (
                              <span key={idx} className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                                {top}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Explicit Study Actions for this Document */}
                      <div className="pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center">
                        <button
                          onClick={() => navigate(`/study?course_id=${selectedCourseId}&material_id=${mat.id}`)}
                          className="px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Study Guide"
                        >
                          <BookOpen className="w-3 h-3" /> Study
                        </button>
                        <button
                          onClick={() => navigate('/tutor', {
                            state: {
                              courseId: selectedCourseId,
                              initialPrompt: `What are the core concepts and findings covered in "${mat.title}"?`,
                            },
                          })}
                          className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Ask Tutor"
                        >
                          <HelpCircle className="w-3 h-3" /> Tutor
                        </button>
                        <button
                          onClick={() => navigate(`/practice?course_id=${selectedCourseId}`)}
                          className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Practice Quiz"
                        >
                          <PenTool className="w-3 h-3" /> Practice
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <span className="uppercase font-mono text-[10px]">{mat.file_type}</span>
                        <button
                          onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                          title="Delete Document"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                  <p>No materials uploaded for this course yet.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold cursor-pointer"
                  >
                    Upload Document or Notes
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Topics List */}
          {activeTab === 'topics' && (
            <div className="space-y-4">
              {topics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topics.map((t) => (
                    <div key={t.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900">{t.name}</h4>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {Math.round((t.mastery || 0) * 100)}% Mastery
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{t.description}</p>
                      {t.concepts && t.concepts.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Key Concepts:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {t.concepts.map((c) => (
                              <span
                                key={c.id}
                                className="text-xs px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 border border-slate-200"
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  No topics extracted yet. Upload course materials to automatically extract knowledge nodes.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Syllabus Intelligence */}
          {activeTab === 'syllabus' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Syllabus Intelligence</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Track topics from the syllabus, connect them to upload notes, and monitor learning readiness.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const snapshot = await knowledgeService.syncSyllabus(currentCourse.id, {
                          subject_name: currentCourse.title,
                          subject_code: currentCourse.code,
                          syllabus_text: currentCourse.description || '',
                          topics: topics.map((topic) => topic.name),
                        });
                        setSyllabus(snapshot);
                        await loadCourseDetails(currentCourse.id);
                      } catch (error) {
                        console.error('Unable to sync syllabus', error);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Sync syllabus overview
                  </button>
                </div>
              </div>

              {syllabus && syllabus.topics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {syllabus.topics.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                        <span className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.unit || 'General unit'}</span>
                        <span>{Math.round((item.mastery || 0) * 100)}% mastery</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${Math.round((item.mastery || 0) * 100)}%` }}
                        ></div>
                      </div>
                      {item.concepts && item.concepts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {item.concepts.slice(0, 4).map((concept) => (
                            <span key={concept} className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700">
                              {concept}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  No syllabus map yet. Upload a course description or syllabus text to start tracking topic readiness.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Create New Course</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Operating Systems"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Course Code (Optional)
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. CS-301"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Course Description (Optional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief summary of topics covered in this course..."
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse || !newTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {creatingCourse ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
