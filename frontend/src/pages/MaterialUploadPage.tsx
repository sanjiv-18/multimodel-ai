import React, { useState, useEffect } from 'react';
import { materialService, courseService } from '../services/api';
import { Material, Course } from '../types';
import {
  UploadCloud, FileText, Presentation, Video, CheckCircle2,
  AlertCircle, Sparkles, Layers, Check, Loader2, Trash2
} from 'lucide-react';

export const MaterialUploadPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleDelete = async (matId: string, matTitle: string) => {
    if (!window.confirm(`Delete document "${matTitle}"? Its extracted chunks will be removed from retrieval immediately.`)) {
      return;
    }
    try {
      await materialService.delete(matId);
      if (selectedCourseId) {
        const refreshed = await materialService.list(selectedCourseId);
        setMaterials(refreshed);
      }
    } catch (err) {
      console.error('Failed to delete material', err);
      alert('Could not delete material.');
    }
  };


  const loadData = async () => {
    try {
      const cList = await courseService.list();
      setCourses(cList);
      if (cList.length > 0) {
        const cId = selectedCourseId && cList.some(c => c.id === selectedCourseId)
          ? selectedCourseId
          : cList[0].id;
        setSelectedCourseId(cId);
        const mList = await materialService.list(cId);
        setMaterials(mList);
      } else {
        setMaterials([]);
      }
    } catch (err) {
      console.error('Failed to load materials', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    try {
      const mList = await materialService.list(courseId);
      setMaterials(mList);
    } catch (err) {
      console.error('Failed to load course materials', err);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCourseId) return;
    setUploading(true);
    setError('');
    setSuccessMessage('');

    try {
      setCurrentStage('Ingesting material and preserving section metadata...');
      const uploadedMat = await materialService.upload(
        selectedCourseId,
        selectedFile,
        customTitle || selectedFile.name
      );

      setCurrentStage('Extracting topics and indexing semantic chunks...');
      if (uploadedMat.status === 'completed' && uploadedMat.chunks_count > 0) {
        setSuccessMessage(
          `Successfully ingested "${uploadedMat.title}" with ${uploadedMat.chunks_count} indexed semantic chunks.`
        );
      } else {
        setError(uploadedMat.error_message || `Could not extract readable text from "${uploadedMat.title}".`);
      }
      setSelectedFile(null);
      setCustomTitle('');

      // Refresh list
      const refreshed = await materialService.list(selectedCourseId);
      setMaterials(refreshed);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process material ingestion.');
    } finally {
      setUploading(false);
      setTimeout(() => setCurrentStage(''), 4000);
    }
  };

  if (courses.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
        No courses available. Create a course first to ingest materials.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Course Switcher */}
      {courses.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Course:</span>
          <select
            value={selectedCourseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Box */}
        <div className="lg:col-span-6 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all bg-white flex flex-col items-center justify-center min-h-[220px] ${
              selectedFile ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
              <UploadCloud className="w-7 h-7" />
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <p className="font-bold text-xs sm:text-sm text-indigo-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 font-mono">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Ingestion
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-rose-600 hover:text-rose-800 underline cursor-pointer pt-1"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-800">
                  Drag & Drop course files here, or{' '}
                  <label className="text-indigo-600 hover:text-indigo-800 underline cursor-pointer">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.mp4,.mkv,.avi,.mov,.mp3,.wav"
                      onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                    />
                  </label>
                </p>
                <p className="text-[11px] text-slate-500">
                  Supported: text-based PDF, DOCX, PPTX, TXT/MD notes, and recordings with a VTT transcript
                </p>
              </div>
            )}
          </div>

          {/* Optional Title Input */}
          {selectedFile && (
            <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={selectedFile.name}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Ingesting & Embedding...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Start Ingestion & Topic Extraction
                  </>
                )}
              </button>
            </div>
          )}

          {currentStage && (
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 flex items-center gap-2.5 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600" />
              <span>{currentStage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Existing Materials List */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Indexed Documents ({materials.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Processing Status
            </span>
          </div>

          <div className="space-y-2.5">
            {materials.map((mat) => (
              <div
                key={mat.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                    {(mat.file_type === 'pdf' || mat.file_type === 'docx' || mat.file_type === 'text') && <FileText className="w-4 h-4 text-rose-600" />}
                    {mat.file_type === 'pptx' && <Presentation className="w-4 h-4 text-amber-600" />}
                    {mat.file_type === 'video' && <Video className="w-4 h-4 text-sky-600" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 truncate max-w-[200px]">{mat.title}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {mat.chunks_count} semantic chunks • {(mat.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-semibold ${
                    mat.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : mat.status === 'error'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {mat.status}
                  </span>
                  <button
                    onClick={() => handleDelete(mat.id, mat.title)}
                    title="Delete Document"
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {mat.error_message && (
                  <p className="mt-2 text-[11px] text-rose-700">{mat.error_message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
