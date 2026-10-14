import React from 'react';
import { X, FileText, Presentation, Video, Clock, CheckCircle2, Bookmark } from 'lucide-react';
import { Citation } from '../types';

interface SourceViewerModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export const SourceViewerModal: React.FC<SourceViewerModalProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  const getLocationLabel = () => {
    if (citation.material_type === 'pdf' && citation.page_number) return `Page ${citation.page_number}`;
    if (citation.material_type === 'pptx' && citation.slide_number) return `Slide ${citation.slide_number}`;
    if (citation.material_type === 'video' && citation.video_timestamp) return `Timestamp ${citation.video_timestamp}`;
    return 'Document Excerpt';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              {citation.material_type === 'pdf' && <FileText className="w-5 h-5 text-rose-600" />}
              {citation.material_type === 'pptx' && <Presentation className="w-5 h-5 text-amber-600" />}
              {citation.material_type === 'video' && <Video className="w-5 h-5 text-sky-600" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                {citation.source_name}
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {getLocationLabel()}
                </span>
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Type: <strong className="text-slate-700 uppercase">{citation.material_type}</strong></span>
                <span>•</span>
                <span>Topic: <strong className="text-slate-700">{citation.topic || 'General'}</strong></span>
                {citation.relevance_score && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">Relevance: {(citation.relevance_score * 100).toFixed(0)}%</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Visual Source Representation */}
          {citation.material_type === 'video' ? (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <Video className="w-7 h-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 border border-sky-200 rounded-full text-xs font-mono text-sky-800 mb-2">
                  <Clock className="w-3.5 h-3.5" /> Jumped to: {citation.video_timestamp || '00:00'}
                </div>
                <h4 className="text-sm font-bold text-slate-900">Lecture Video Stream</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Audio transcribed and aligned to timestamp frame {citation.video_timestamp}.
                </p>
              </div>
            </div>
          ) : citation.material_type === 'pptx' ? (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Presentation className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-mono bg-amber-50 text-amber-800 px-2.5 py-1 rounded border border-amber-200">
                  Slide {citation.slide_number || 1}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Lecture Presentation Slide</h4>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {citation.material_type === 'pdf' ? 'PDF Document Reference' : 'Document Excerpt'}
                  </h4>
                  {citation.page_number && (
                    <p className="text-xs text-slate-500 font-mono">Page {citation.page_number} of document</p>
                  )}
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Grounding
              </span>
            </div>
          )}

          {/* Grounded Excerpt Box */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
              Extracted Grounded Chunk Text
            </label>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed font-sans">
              {citation.snippet}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <span className="text-xs text-slate-500">
            Source location preserved by Multimodal Ingestion Agent
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
