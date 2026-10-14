import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tutorService, courseService, materialService } from '../services/api';
import { Course, Message, Citation } from '../types';
import { CitationBadge } from '../components/CitationBadge';
import { SourceViewerModal } from '../components/SourceViewerModal';
import {
  Send,
  RefreshCw,
  Paperclip,
  X,
  FileText,
  FolderPlus
} from 'lucide-react';

export const TutorChatPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [focusedMaterialId, setFocusedMaterialId] = useState<string | undefined>(undefined);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialPromptHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const initTutor = async () => {
      try {
        const cList = await courseService.list();
        setCourses(cList);
        if (cList.length > 0) {
          const requestedCourseId = (location.state as any)?.courseId;
          const cId = cList.some((course) => course.id === requestedCourseId)
            ? requestedCourseId
            : cList[0].id;
          setSelectedCourseId(cId);
          const requestedMaterialId = (location.state as any)?.materialId;
          if (requestedMaterialId) setFocusedMaterialId(requestedMaterialId);
          const convs = await tutorService.listConversations(cId);
          if (convs.length > 0 && convs[0].messages.length > 0) {
            setConversationId(convs[0].id);
            setMessages(convs[0].messages);
          } else {
            setMessages([
              {
                id: 'init-1',
                sender: 'tutor',
                content: `Hi! I am your AI course tutor for **${cList.find((course) => course.id === cId)?.title || cList[0].title}**. Ask any doubt grounded in your course materials, or click 📎 to upload class notes and slides directly.`,
                citations: [],
                is_grounded: true,
                created_at: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load tutor', err);
      }
    };
    initTutor();
  }, [location.state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setFocusedMaterialId(undefined);
    try {
      const convs = await tutorService.listConversations(courseId);
      if (convs.length > 0 && convs[0].messages.length > 0) {
        setConversationId(convs[0].id);
        setMessages(convs[0].messages);
      } else {
        const cObj = courses.find(c => c.id === courseId);
        setConversationId(undefined);
        setMessages([
          {
            id: `init-${courseId}`,
            sender: 'tutor',
            content: `Hi! I am your AI tutor for **${cObj?.title || 'this course'}**. Ask me any doubt grounded in your course materials.`,
            citations: [],
            is_grounded: true,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to switch course conversations', err);
    }
  };

  const handleSend = useCallback(async (queryToSend?: string) => {
    const query = queryToSend || inputQuery;
    if ((!query.trim() && !attachedFile) || !selectedCourseId || loading) return;

    const courseId = selectedCourseId;
    let finalQuery = query.trim();
    let materialId = focusedMaterialId;

    setLoading(true);
    setInputQuery('');

    // If a file is attached, upload & ingest it first
    if (attachedFile) {
      setUploadingFile(true);
      try {
        const uploadedMaterial = await materialService.upload(
          courseId,
          attachedFile,
          attachedFile.name
        );
        
        const fileName = attachedFile.name;
        setAttachedFile(null);
        if (uploadedMaterial.status !== 'completed' || uploadedMaterial.chunks_count < 1) {
          setMessages((prev) => [...prev, {
            id: `upload-error-${Date.now()}`,
            sender: 'tutor',
            content: uploadedMaterial.error_message
              ? `I couldn't process "${fileName}": ${uploadedMaterial.error_message}`
              : `I couldn't extract readable study text from "${fileName}". Please reprocess it or upload a text-based version.`,
            citations: [],
            is_grounded: false,
            created_at: new Date().toISOString(),
          }]);
          setLoading(false);
          return;
        }
        materialId = uploadedMaterial.id;
        setFocusedMaterialId(uploadedMaterial.id);

        if (!finalQuery) {
          finalQuery = `I just uploaded "${fileName}". Please explain the key concepts and summarize the main takeaways.`;
        }

        const userMsg: Message = {
          id: `user-${Date.now()}`,
          sender: 'user',
          content: `📎 [Uploaded: ${fileName}]\n\n${finalQuery}`,
          citations: [],
          is_grounded: true,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
      } catch (uploadErr) {
        console.error('Error uploading attached note', uploadErr);
        const detail = (uploadErr as any)?.response?.data?.detail;
        setMessages((prev) => [...prev, {
          id: `upload-error-${Date.now()}`,
          sender: 'tutor',
          content: detail || 'I could not upload or process that document. Please check its format and try again.',
          citations: [],
          is_grounded: false,
          created_at: new Date().toISOString(),
        }]);
        setLoading(false);
        return;
      } finally {
        setUploadingFile(false);
      }
    } else {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        sender: 'user',
        content: finalQuery,
        citations: [],
        is_grounded: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    try {
      const res = await tutorService.chat(courseId, finalQuery, conversationId, materialId);
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      console.error('Failed to get tutor answer', err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'tutor',
        content:
          'I encountered a connection error while checking course materials. Please make sure materials are uploaded or try again.',
        citations: [],
        is_grounded: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [attachedFile, conversationId, focusedMaterialId, inputQuery, loading, selectedCourseId]);

  useEffect(() => {
    const initialPrompt = (location.state as any)?.initialPrompt;
    if (!selectedCourseId || !initialPrompt || initialPromptHandledRef.current === location.key) return;
    initialPromptHandledRef.current = location.key;
    setInputQuery(initialPrompt);
    void handleSend(initialPrompt);
  }, [handleSend, location.key, location.state, selectedCourseId]);

  const handleActionClick = (actionType: 'simply' | 'example' | 'practice' | 'source', lastMsg: Message) => {
    if (actionType === 'simply') {
      handleSend('Can you explain this again in simpler terms with a basic analogy?');
    } else if (actionType === 'example') {
      handleSend('Can you provide a clear, step-by-step concrete example of this?');
    } else if (actionType === 'practice') {
      navigate('/practice');
    } else if (actionType === 'source') {
      if (lastMsg.citations && lastMsg.citations.length > 0) {
        setActiveCitation(lastMsg.citations[0]);
      }
    }
  };

  // If no courses exist
  if (courses.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center space-y-5 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
          <FolderPlus className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">No Courses Available</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            To ask doubts grounded in your learning materials, create a course and upload your documents first.
          </p>
        </div>
        <button
          onClick={() => navigate('/courses')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <FolderPlus className="w-4 h-4" /> Create Course in My Courses
        </button>
      </div>
    );
  }

  const currentCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col h-[calc(100vh-4.5rem)] animate-fadeIn">
      {/* Header with Course Selector */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">AI Tutor</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              Source Grounded
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Answers backed strictly by uploaded documents
          </p>
        </div>

        {courses.length > 1 && (
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
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
        {messages.map((m, idx) => {
          const isTutor = m.sender === 'tutor';
          const isLatestTutor = isTutor && idx === messages.length - 1;

          return (
            <div
              key={m.id || idx}
              className={`flex flex-col ${isTutor ? 'items-start' : 'items-end'} space-y-2`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[90%] sm:max-w-[82%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isTutor
                    ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
                    : 'bg-indigo-600 text-white shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Grounded Citations Badges */}
                {isTutor && m.citations && m.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">
                      Sources:
                    </span>
                    {m.citations.map((c, cIdx) => (
                      <CitationBadge
                        key={cIdx}
                        citation={c}
                        onClick={() => setActiveCitation(c)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Contextual Action Chips (For latest Tutor message) */}
              {isLatestTutor && !loading && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-1">
                  <button
                    onClick={() => handleActionClick('simply', m)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                  >
                    💡 Explain simply
                  </button>
                  <button
                    onClick={() => handleActionClick('example', m)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                  >
                    🔍 Show example
                  </button>
                  <button
                    onClick={() => handleActionClick('practice', m)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    📝 Practice with me
                  </button>
                  {m.citations && m.citations.length > 0 && (
                    <button
                      onClick={() => handleActionClick('source', m)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                    >
                      📖 Show source
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-500 shadow-sm max-w-md">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>
              {uploadingFile
                ? 'Ingesting attached notes and extracting knowledge chunks...'
                : 'Retrieving grounded excerpts & formulating explanation...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box with Attachment */}
      <div className="shrink-0 pt-2 pb-1 space-y-2">
        {/* Attached File Preview Chip */}
        {attachedFile && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 animate-fadeIn">
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-semibold truncate">{attachedFile.name}</span>
              <span className="text-[11px] text-indigo-500">
                ({(attachedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="p-1 text-indigo-400 hover:text-indigo-700 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".txt,.pdf,.docx,.pptx,.md,.markdown,.mp4,.mkv,.avi,.mov,.mp3,.wav"
            className="hidden"
          />

          {/* Paperclip Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Notes, Slide Deck, or PDF"
            className="absolute left-2.5 p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              attachedFile
                ? `Ask doubt about "${attachedFile.name}"...`
                : `Ask any question grounded in ${currentCourse.title}...`
            }
            className="w-full pl-12 pr-24 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-xs"
          />

          <button
            type="submit"
            disabled={(!inputQuery.trim() && !attachedFile) || loading}
            className="absolute right-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>

      {/* Source Viewer Modal */}
      {activeCitation && (
        <SourceViewerModal
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      )}
    </div>
  );
};
