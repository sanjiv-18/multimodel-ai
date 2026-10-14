import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap, BookOpen, Brain, CheckCircle,
  ArrowRight, Layers, FileText, Video, Presentation, ShieldCheck
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              LF
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900">
                LearnFlow AI
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-500 ml-2">
                Adaptive Multi-Agent Tutor
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Multimodal AI Hackathon 2026 • Track D
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 py-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left Column: Value Proposition */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700">
            <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
            Source-Grounded Personalized Learning
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Learn from your course materials. <br />
            <span className="text-indigo-600">
              Master what comes next.
            </span>
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            LearnFlow AI ingests textbooks, lecture slides, notes, and video recordings to provide
            strictly grounded tutoring with exact clickable citations, adaptive quizzing, and transparent mastery tracking.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
              <FileText className="w-4 h-4 text-rose-500" />
              <div className="font-semibold text-slate-800">PDFs & Notes</div>
              <div className="text-[11px] text-slate-500">Page-level citations</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
              <Presentation className="w-4 h-4 text-amber-500" />
              <div className="font-semibold text-slate-800">Slide Decks</div>
              <div className="text-[11px] text-slate-500">Slide # tracking</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
              <Video className="w-4 h-4 text-sky-500" />
              <div className="font-semibold text-slate-800">Lecture Videos</div>
              <div className="text-[11px] text-slate-500">Timestamp jumps</div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
          <div className="text-center space-y-1 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto text-white shadow-md shadow-indigo-600/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 pt-2">
              {isLogin ? 'Sign In to LearnFlow' : 'Create Student Account'}
            </h2>
            <p className="text-xs text-slate-500">
              {isLogin
                ? 'Enter your credentials to access your courses and notes'
                : 'Start your personalized learning journey with your own notes'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Password
                </label>
                <span className="text-[11px] text-slate-500">
                  Minimum 8 characters
                </span>
              </div>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-[11px] text-amber-600 mt-1 font-medium">
                  Password must be at least 8 characters ({password.length}/8)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {isLogin && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('demo@learnflow.ai');
                    setPassword('demo1234');
                    setError('');
                  }}
                  className="text-xs text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Quick Fill Demo Credentials (<span className="font-mono text-slate-700">demo1234</span>)
                </button>
              </div>
            )}
          </form>

          <div className="text-center mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setError('');
                setIsLogin(!isLogin);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors cursor-pointer"
            >
              {isLogin ? "Don't have an account? Create one here" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        LearnFlow AI • Track D: Personalized Tutoring & Adaptive Learning • 8 Logical AI Agents + LangGraph
      </footer>
    </div>
  );
};
