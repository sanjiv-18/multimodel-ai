import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseService, materialService } from '../services/api';
import { Course, Material } from '../types';
import {
  UploadCloud, FileText, Presentation, Video, CheckCircle2,
  AlertCircle, Sparkles, X, Loader2, FolderPlus, HelpCircle,
  PenTool, BookOpen, Trash2
} from 'lucide-react';

interface UploadNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: (courseId: string, material: Material) => void;
  defaultCourseId?: string;
}

export const UploadNotesModal: React.FC<UploadNotesModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  defaultCourseId,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');

  // Course creation state
  const [showCreateCourse, setShowCreateCourse] = useState<boolean>(false);
  const [newCourseTitle, setNewCourseTitle] = useState<string>('');
  const [newCourseCode, setNewCourseCode] = useState<string>('');
  const [creatingCourse, setCreatingCourse] = useState<boolean>(false);

  // Upload & processing state
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgressStage, setUploadProgressStage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [completedMaterial, setCompletedMaterial] = useState<Material | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCourses();
      resetForm();
    }
  }, [isOpen, defaultCourseId]);

  const resetForm = () => {
    setSelectedFile(null);
    setCustomTitle('');
    setError('');
    setCompletedMaterial(null);
    setShowCreateCourse(false);
    setNewCourseTitle('');
    setNewCourseCode('');
    setUploadProgressStage('');
  };

  const loadCourses = async () => {
    try {
      const cList = await courseService.list();
      setCourses(cList);
      if (defaultCourseId && cList.some(c => c.id === defaultCourseId)) {
        setSelectedCourseId(defaultCourseId);
      } else if (cList.length > 0) {
        setSelectedCourseId(cList[0].id);
      } else {
        setSelectedCourseId('');
        setShowCreateCourse(true);
      }
    } catch (err) {
      console.error('Failed to load courses', err);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    setCreatingCourse(true);
    try {
      const created = await courseService.create(newCourseTitle.trim(), '', newCourseCode.trim());
      setCourses(prev => [created, ...prev]);
      setSelectedCourseId(created.id);
      setShowCreateCourse(false);
      setNewCourseTitle('');
      setNewCourseCode('');
    } catch (err) {
      console.error('Failed to create course', err);
      setError('Could not create course. Please try again.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    // Validate format
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['pdf', 'docx', 'pptx', 'txt', 'md', 'markdown', 'mp4', 'mkv', 'avi', 'mov', 'mp3', 'wav'];
    if (!ext || !validExts.includes(ext)) {
      setError(`Unsupported file type (.${ext}). Supported formats: PDF, DOCX, PPTX, TXT/MD, and recordings with a VTT transcript.`);
      return;
    }
    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB limit.');
      return;
    }
    setError('');
    setSelectedFile(file);
    if (!customTitle) {
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile || !selectedCourseId) {
      setError('Please select a course and choose a document.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgressStage('Uploading document to secure course storage...');

    try {
      setUploadProgressStage('Extracting sections and preserving page/slide metadata...');
      const uploadedMat = await materialService.upload(
        selectedCourseId,
        selectedFile,
        customTitle.trim() || selectedFile.name
      );

      setUploadProgressStage('Indexing semantic chunks and topic nodes...');
      if (uploadedMat.status !== 'completed' || uploadedMat.chunks_count < 1) {
        setError(uploadedMat.error_message || `Could not extract readable text from "${uploadedMat.title}".`);
      } else {
        setCompletedMaterial(uploadedMat);
        if (onUploadSuccess) {
          onUploadSuccess(selectedCourseId, uploadedMat);
        }
      }
    } catch (err: any) {
      console.error('Failed to process material upload', err);
      setError(err.response?.data?.detail || 'Failed to process and index document. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgressStage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {completedMaterial ? 'Ready to Study' : 'Upload Notes & Study'}
              </h3>
              <p className="text-xs text-slate-500">
                {completedMaterial
                  ? 'Your class notes are extracted and ready for source-grounded learning.'
                  : 'Upload your class notes, slides, or textbook and learn directly from your materials.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* SUCCESS SCREEN */}
          {completedMaterial ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-slate-900">
                  Your notes are ready to study
                </h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Successfully extracted and indexed <span className="font-semibold text-slate-900">"{completedMaterial.title}"</span> into{' '}
                  <span className="font-semibold text-slate-900">{completedMaterial.chunks_count} semantic chunks</span> with source locations preserved.
                </p>
              </div>

              {completedMaterial.extracted_topics && completedMaterial.extracted_topics.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 max-w-md mx-auto">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Extracted Topics:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {completedMaterial.extracted_topics.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 shadow-2xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 Prominent Post-Processing Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/study?course_id=${selectedCourseId}&material_id=${completedMaterial.id}`);
                  }}
                  className="p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-left space-y-2 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-indigo-950 group-hover:text-indigo-600 transition-colors">
                      Study My Notes
                    </h5>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      Grounded study guide & key points.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    navigate('/tutor', {
                      state: {
                        courseId: selectedCourseId,
                        materialId: completedMaterial.id,
                        initialPrompt: `I just uploaded "${completedMaterial.title}". What are the key concepts and fundamental principles covered?`,
                      },
                    });
                  }}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-2 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Ask Questions
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ask tutor with page-level citations.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    navigate(`/practice?course_id=${selectedCourseId}`);
                  }}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-2 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Practice Quiz
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Adaptive quiz from uploaded notes.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* UPLOAD FORM */
            <div className="space-y-5">
              {/* Course Selection or Create */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-700">Select Target Course</label>
                  <button
                    type="button"
                    onClick={() => setShowCreateCourse(!showCreateCourse)}
                    className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer inline-flex items-center gap-1"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    {showCreateCourse ? 'Select Existing Course' : '+ Create New Course'}
                  </button>
                </div>

                {showCreateCourse ? (
                  <form onSubmit={handleCreateCourse} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <input
                        type="text"
                        required
                        value={newCourseTitle}
                        onChange={(e) => setNewCourseTitle(e.target.value)}
                        placeholder="Course title, e.g. Data Structures & Algorithms"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        placeholder="Code (optional, e.g. CS-201)"
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={creatingCourse || !newCourseTitle.trim()}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                      >
                        {creatingCourse ? 'Creating...' : 'Save Course'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `[${c.code}] ` : ''}{c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Drag & Drop File Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                  selectedFile
                    ? 'border-indigo-400 bg-indigo-50/30'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.mp4,.mkv,.avi,.mov,.mp3,.wav"
                  className="hidden"
                />

                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                    <UploadCloud className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">
                      Drag and drop your study document here, or <span className="text-indigo-600 underline">browse</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports text-based PDF, DOCX, PPTX, TXT/MD, and recordings with VTT transcript (up to 50MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected File Details */}
              {selectedFile && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600">
                        {selectedFile.name.endsWith('.pdf') && <FileText className="w-4 h-4 text-rose-500" />}
                        {selectedFile.name.endsWith('.pptx') && <Presentation className="w-4 h-4 text-amber-500" />}
                        {selectedFile.name.endsWith('.mp4') && <Video className="w-4 h-4 text-sky-500" />}
                        {!selectedFile.name.endsWith('.pdf') && !selectedFile.name.endsWith('.pptx') && !selectedFile.name.endsWith('.mp4') && (
                          <FileText className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 truncate max-w-[260px]">
                          {selectedFile.name}
                        </h5>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Document Title (optional)
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Chapter 4 — Dynamic Programming Notes"
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Processing Progress */}
              {uploading && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2.5 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <span>{uploadProgressStage}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={uploading || !selectedFile || !selectedCourseId}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Ingesting & Extracting Notes...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Start Ingestion & Study
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
