"use client";

import { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message { role: string; content: string; }

interface Progress {
  totalSessions: number;
  streak: number;
  lastSessionDate: string;
  totalMinutes: number;
  badges: string[];
  sessionHistory: { date: string; level: string; theme: string; turns: number; duration: number }[];
}

interface SummaryData {
  corrections: { wrong: string; correct: string; explanation: string }[];
  goodPhrases: string[];
  overallComment: string;
  turnCount: number;
  rating: number;
}

// ─── Data ────────────────────────────────────────────────────────────────────
const THEMES = [
  { label: "Coffee Shop Ordering",     emoji: "☕" },
  { label: "Job Interview",            emoji: "💼" },
  { label: "Airport Check-in",         emoji: "✈️" },
  { label: "Doctor Appointment",       emoji: "🏥" },
  { label: "Supermarket Shopping",     emoji: "🛒" },
  { label: "Daily Routine",            emoji: "🌤️" },
  { label: "Travel Planning",          emoji: "🧳" },
  { label: "Self-Introduction",        emoji: "🤝" },
  { label: "Business Negotiation",     emoji: "📊" },
  { label: "Talking about Hobbies",    emoji: "🎨" },
  { label: "Ordering at a Restaurant", emoji: "🍽️" },
  { label: "Asking for Directions",    emoji: "🗺️" },
  { label: "Check-in at a Hotel",      emoji: "🏨" },
];

const PERSONA_MAP: Record<string, { name: string; emoji: string }> = {
  "Coffee Shop Ordering":     { name: "Alex",        emoji: "☕" },
  "Job Interview":            { name: "Sarah Chen",  emoji: "💼" },
  "Airport Check-in":         { name: "James",       emoji: "✈️" },
  "Doctor Appointment":       { name: "Dr. Williams",emoji: "🏥" },
  "Supermarket Shopping":     { name: "Tom",         emoji: "🛒" },
  "Daily Routine":            { name: "Emma",        emoji: "🌤️" },
  "Travel Planning":          { name: "Lisa",        emoji: "🧳" },
  "Self-Introduction":        { name: "Mike",        emoji: "🤝" },
  "Business Negotiation":     { name: "Ms. Parker",  emoji: "📊" },
  "Talking about Hobbies":    { name: "Jamie",       emoji: "🎨" },
  "Ordering at a Restaurant": { name: "Sofia",       emoji: "🍽️" },
  "Asking for Directions":    { name: "David",       emoji: "🗺️" },
  "Check-in at a Hotel":      { name: "Rachel",      emoji: "🏨" },
  "Free Talk":                { name: "Chris",       emoji: "💬" },
};

const DEFAULT_PROGRESS: Progress = {
  totalSessions: 0, streak: 0, lastSessionDate: '',
  totalMinutes: 0, badges: [], sessionHistory: [],
};

const HELP_PHRASES = [
  { text: "Sorry, could you say that again?", zh: "抱歉，可以再說一次嗎？" },
  { text: "Could you speak slower, please?",  zh: "可以說慢一點嗎？" },
  { text: "I don't understand.",              zh: "我不明白。" },
  { text: "What does that mean?",             zh: "那是什麼意思？" },
  { text: "How do you spell that?",           zh: "那怎麼拼？" },
  { text: "Can you give me an example?",      zh: "可以給我例子嗎？" },
];

// ─── Summary Modal ────────────────────────────────────────────────────────────
function SummaryModal({ data, isLoading, level, theme, progress, onKeepLearning, onEnd }: {
  data: SummaryData | null; isLoading: boolean; level: string; theme: string;
  progress: Progress; onKeepLearning: () => void; onEnd: () => void;
}) {
  const newBadges = progress.badges;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center">
          <div className="text-5xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-indigo-200 text-sm mt-1">{level} · {theme}</p>
          <div className="flex justify-center gap-4 mt-3 text-white/80 text-sm">
            <span>🔥 {progress.streak} day streak</span>
            <span>·</span>
            <span>📚 {progress.totalSessions} sessions total</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-10">
              <div className="flex justify-center gap-1.5 mb-4">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-slate-400 text-sm">AI is reviewing your session...</p>
            </div>
          ) : data ? (
            <>
              {/* Star Rating */}
              <div className="text-center space-y-2">
                <div className="flex justify-center gap-1 text-3xl">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < data.rating ? 'opacity-100' : 'opacity-20'}>⭐</span>
                  ))}
                </div>
                <p className="text-slate-300 text-sm italic px-4">"{data.overallComment}"</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Exchanges", value: data.turnCount, color: "text-indigo-400" },
                  { label: "Great Phrases", value: data.goodPhrases?.length || 0, color: "text-emerald-400" },
                  { label: "Corrections", value: data.corrections?.length || 0, color: "text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800 rounded-xl p-3 text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Good Phrases */}
              {data.goodPhrases?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">✨ Great Phrases You Used</h4>
                  <ul className="space-y-1.5">
                    {data.goodPhrases.map((p, i) => (
                      <li key={i} className="text-sm text-slate-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">"{p}"</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grammar Corrections */}
              {data.corrections?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">📝 Grammar Tips</h4>
                  <ul className="space-y-2">
                    {data.corrections.map((c, i) => (
                      <li key={i} className="text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-400 line-through">{c.wrong}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-emerald-400 font-medium">{c.correct}</span>
                        </div>
                        <p className="text-slate-500 text-xs mt-1">{c.explanation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Badges */}
              {newBadges.length > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">🏅 Your Badges</h4>
                  <div className="flex flex-wrap gap-2">
                    {newBadges.map(b => {
                      const map: Record<string,string> = { first_session:'🌟 First Session', '3_day_streak':'🔥 3-Day Streak', '7_day_streak':'🔥 7-Day Streak', '10_sessions':'📚 10 Sessions', '30_sessions':'🏆 30 Sessions' };
                      return <span key={b} className="text-xs px-2 py-1 bg-indigo-600/30 border border-indigo-500/30 rounded-full text-indigo-300">{map[b] || b}</span>;
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <p className="text-4xl mb-2">✅</p>
              <p>Session complete! Keep up the great work.</p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onKeepLearning}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all font-bold text-white shadow-lg shadow-indigo-500/20">
            Keep Learning 🚀
          </button>
          <button onClick={onEnd}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-all font-bold text-slate-300 border border-slate-700">
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  // UI step flow
  const [step, setStep] = useState<'select-level' | 'select-theme' | 'session'>('select-level');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | null>(null);
  const [theme, setTheme]  = useState<string>('');
  const [customTheme, setCustomTheme] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Session state
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your AI English Teacher. Choose your level to start." }
  ]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [timeLeft, setTimeLeft]     = useState(1800);
  const [isActive, setIsActive]     = useState(false);
  const [isFreeTalk, setIsFreeTalk] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [materials, setMaterials]   = useState<{ vocabulary: string[]; phrases: string[]; responses?: string[] } | null>(null);
  const [translation, setTranslation]   = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showHelp, setShowHelp]           = useState(false);
  const [currentCaption, setCurrentCaption] = useState('');
  const [responseHints, setResponseHints]   = useState<string[]>([]);
  const [showResponseHints, setShowResponseHints] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Progress
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);

  // Summary
  const [showSummary, setShowSummary]       = useState(false);
  const [summaryData, setSummaryData]       = useState<SummaryData | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Audio visualizer — direct DOM refs (no re-render on every frame)
  const ringRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const listenAnimRef = useRef<number | null>(null);
  const speakAnimRef  = useRef<number | null>(null);

  // Speech refs
  const recognitionRef = useRef<any>(null);
  const synthRef       = useRef<SpeechSynthesis | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Timer refs
  const pendingTranscriptRef = useRef('');
  const translationTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const captionTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef      = useRef<NodeJS.Timeout | null>(null);
  const speakTimeoutRef      = useRef<NodeJS.Timeout | null>(null);

  // Stale-closure guards
  const messagesRef = useRef(messages);
  const levelRef    = useRef(level);
  const themeRef    = useRef(theme);
  const statusRef   = useRef(status);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { levelRef.current = level; },       [level]);
  useEffect(() => { themeRef.current = theme; },       [theme]);
  useEffect(() => { statusRef.current = status; },     [status]);

  // Derived
  const persona = PERSONA_MAP[theme] ?? { name: 'Teacher', emoji: '👨‍🏫' };

  // ── Visualizer helpers ──────────────────────────────────────────────────────
  const setRingLevel = (lvl: number) => {
    ringRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const scale   = 1 + lvl * (0.55 - i * 0.12);
      const opacity = lvl > 0.01 ? Math.max(0.05, 0.55 - i * 0.13) : 0.08;
      ref.current.style.transform = `scale(${scale})`;
      ref.current.style.opacity   = String(opacity);
    });
  };

  const stopAllAnimations = () => {
    if (listenAnimRef.current) { cancelAnimationFrame(listenAnimRef.current); listenAnimRef.current = null; }
    if (speakAnimRef.current)  { cancelAnimationFrame(speakAnimRef.current);  speakAnimRef.current  = null; }
    setRingLevel(0);
  };

  // Unified sine-wave animation — speed & amplitude vary by state
  const startAnimation = (speed: number, amplitude: number, base: number, ref: React.MutableRefObject<number | null>) => {
    if (ref.current) cancelAnimationFrame(ref.current);
    let t = 0;
    const tick = () => {
      t += speed;
      setRingLevel(Math.abs(Math.sin(t)) * amplitude + base);
      ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
  };

  // Drive visualizer purely from status — NO getUserMedia needed
  useEffect(() => {
    stopAllAnimations();
    if      (status === 'speaking')    startAnimation(0.08, 0.60, 0.15, speakAnimRef);
    else if (status === 'listening')   startAnimation(0.04, 0.35, 0.08, listenAnimRef);
    else if (status === 'processing')  startAnimation(0.02, 0.15, 0.04, speakAnimRef);
    // idle: rings stay at 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('ai-coach-progress');
      if (saved) setProgress(JSON.parse(saved));
    } catch (_) {}

    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognitionRef.current = new SR();
      recognitionRef.current.continuous    = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang           = 'en-US';

      recognitionRef.current.onresult = (e: any) => {
        let txt = '';
        for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
        setTranscript(txt); pendingTranscriptRef.current = txt;
      };
      recognitionRef.current.onerror = (e: any) => {
        if (e.error !== 'aborted') setStatusMessage(`Error: ${e.error}`);
        setStatus('idle');
      };
      recognitionRef.current.onend = () => {
        const final = pendingTranscriptRef.current;
        if (final?.trim()) { handleVoiceInput(final.trim()); pendingTranscriptRef.current = ''; }
        else { setStatus('idle'); setStatusMessage(''); }
      };
    }
    synthRef.current = window.speechSynthesis;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || timeLeft <= 0) {
      if (timeLeft === 0) { setIsActive(false); speak("Time is up! You did a fantastic job today."); }
      return;
    }
    const id = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, timeLeft]);

  // ── Progress ─────────────────────────────────────────────────────────────────
  const saveProgress = (turns: number, mins: number) => {
    const today = new Date().toDateString();
    setProgress(prev => {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      let streak = prev.streak;
      if      (prev.lastSessionDate === today)                  { /* same day */ }
      else if (prev.lastSessionDate === yest.toDateString())    { streak++; }
      else                                                       { streak = 1; }
      const total = prev.totalSessions + 1;
      const badges = new Set(prev.badges);
      if (total === 1)   badges.add('first_session');
      if (streak >= 3)   badges.add('3_day_streak');
      if (streak >= 7)   badges.add('7_day_streak');
      if (total >= 10)   badges.add('10_sessions');
      if (total >= 30)   badges.add('30_sessions');
      const next: Progress = {
        totalSessions: total, streak, lastSessionDate: today,
        totalMinutes: prev.totalMinutes + mins,
        badges: Array.from(badges),
        sessionHistory: [
          { date: today, level: levelRef.current!, theme: themeRef.current, turns, duration: mins },
          ...prev.sessionHistory.slice(0, 29)
        ],
      };
      try { localStorage.setItem('ai-coach-progress', JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const clearTranslationTimer = () => {
    if (translationTimerRef.current) { clearTimeout(translationTimerRef.current); translationTimerRef.current = null; }
  };
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setShowResponseHints(false);
  };
  const startSilenceTimer = () => {
    clearSilenceTimer();
    if (levelRef.current !== 'Beginner') return;
    silenceTimerRef.current = setTimeout(() => setShowResponseHints(true), 8000);
  };
  const startTranslationTimer = (text: string) => {
    clearTranslationTimer();
    if (levelRef.current !== 'Beginner') return;
    translationTimerRef.current = setTimeout(async () => {
      setIsTranslating(true);
      try {
        const r = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        const d = await r.json();
        if (d.translation) { setTranslation(d.translation); speak(d.translation, 'zh-TW'); }
      } catch (_) {} finally { setIsTranslating(false); }
    }, 10000);
  };
  const defaultHints = () => ["Yes, I understand.", "No, I don't understand.", "Can you repeat that?", "Please speak slower."];

  // ── TTS ─────────────────────────────────────────────────────────────────────
  const speak = (text: string, lang = 'en-US', rate?: number) => {
    if (!synthRef.current || !text?.trim()) { setStatus('idle'); return; }
    if (speakTimeoutRef.current) { clearTimeout(speakTimeoutRef.current); speakTimeoutRef.current = null; }
    if (statusRef.current === 'listening') recognitionRef.current?.stop();
    if (captionTimerRef.current) { clearInterval(captionTimerRef.current); captionTimerRef.current = null; }
    synthRef.current.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = rate !== undefined ? rate
      : lang === 'en-US' ? (levelRef.current === 'Beginner' ? 0.8 : levelRef.current === 'Intermediate' ? 1.0 : 1.1)
      : 1.0;

    if (lang === 'en-US') {
      setCurrentCaption('');
      let idx = 0;
      const spd = levelRef.current === 'Beginner' ? 120 : 80;
      captionTimerRef.current = setInterval(() => {
        if (idx < text.length) { setCurrentCaption(text.slice(0, ++idx)); }
        else { clearInterval(captionTimerRef.current!); captionTimerRef.current = null; }
      }, spd);
    }

    speakTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
      if (captionTimerRef.current) { clearInterval(captionTimerRef.current); captionTimerRef.current = null; }
    }, Math.max(text.length * 150, 5000));

    utt.onend = () => {
      if (speakTimeoutRef.current) { clearTimeout(speakTimeoutRef.current); speakTimeoutRef.current = null; }
      setStatus('idle'); setCurrentCaption(text);
      if (captionTimerRef.current) { clearInterval(captionTimerRef.current); captionTimerRef.current = null; }
      if (lang === 'en-US' && levelRef.current === 'Beginner') {
        startTranslationTimer(text);
        setResponseHints(materials?.responses ?? defaultHints());
      }
    };
    utt.onerror = () => {
      if (speakTimeoutRef.current) { clearTimeout(speakTimeoutRef.current); speakTimeoutRef.current = null; }
      setStatus('idle');
      if (captionTimerRef.current) { clearInterval(captionTimerRef.current); captionTimerRef.current = null; }
    };

    setStatus('speaking');
    synthRef.current.speak(utt);
  };

  // ── Voice input ──────────────────────────────────────────────────────────────
  const handleVoiceInput = async (text: string) => {
    if (!text.trim()) { setStatus('idle'); return; }
    clearTranslationTimer(); setTranslation(null);
    const userMsg: Message = { role: 'user', content: text };
    setMessages(p => [...p, userMsg]); setTranscript(''); setStatus('processing');
    setStatusMessage('Talking to AI Teacher...');
    try {
      const res  = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messagesRef.current, userMsg], level: levelRef.current, theme: themeRef.current }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const content = data.content ?? '';
      setStatusMessage('AI is responding...');
      setMessages(p => [...p, { role: 'assistant', content }]);
      if (data.responses?.length > 0) {
        setResponseHints(data.responses);
        if (materials) setMaterials({ ...materials, responses: data.responses });
      }
      speak(content);
    } catch (err: any) {
      console.error(err); setStatusMessage(`Error: ${err.message}`);
      speak("I'm sorry, I encountered an error. Please try again.");
    }
  };

  const handleHelpPhrase = async (phrase: { text: string }) => {
    setShowHelp(false); clearTranslationTimer(); setTranslation(null);
    const userMsg: Message = { role: 'user', content: phrase.text };
    setMessages(p => [...p, userMsg]); speak(phrase.text);
    try {
      const res  = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messagesRef.current, userMsg], level: levelRef.current, theme: themeRef.current }) });
      const data = await res.json();
      if (data.content) {
        setMessages(p => [...p, { role: 'assistant', content: data.content }]);
        if (data.responses?.length > 0) { setResponseHints(data.responses); if (materials) setMaterials({ ...materials, responses: data.responses }); }
        setTimeout(() => speak(data.content), 500);
      }
    } catch (err) { console.error(err); }
  };

  const handleResponseHint = (hint: string) => { clearSilenceTimer(); setShowResponseHints(false); handleVoiceInput(hint); };

  const replayLast = (slow = false) => {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    if (last) speak(last.content, 'en-US', slow ? 0.6 : undefined);
  };

  // ── Mic toggle ───────────────────────────────────────────────────────────────
  const toggleListening = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
      clearSilenceTimer();
      setStatusMessage('Processing...');
    } else if (status === 'idle') {
      clearTranslationTimer(); setTranslation(null); clearSilenceTimer();
      if (!recognitionRef.current) { alert("Speech Recognition not supported. Use Safari on iOS."); return; }
      recognitionRef.current.continuous = levelRef.current === 'Beginner';
      setTranscript(''); pendingTranscriptRef.current = '';
      try {
        recognitionRef.current.start();
        setStatus('listening');
        setStatusMessage(levelRef.current === 'Beginner' ? 'Listening (Continuous)...' : 'Listening...');
        startSilenceTimer();
      } catch (e) { console.error(e); setStatus('idle'); }
    }
  };

  // ── Start lesson ─────────────────────────────────────────────────────────────
  const startLesson = (selectedLevel: 'Beginner' | 'Intermediate' | 'Advanced', selectedTheme: string, freeTalk = false) => {
    // Audio unlock
    if (synthRef.current) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synthRef.current.speak(u); }

    setLevel(selectedLevel); setTheme(selectedTheme); setIsFreeTalk(freeTalk);
    setIsActive(true); setStatus('processing'); setTranslation(null); clearTranslationTimer();
    sessionStartRef.current = Date.now(); setStep('session');

    if (!freeTalk) {
      fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel, theme: selectedTheme }) })
        .then(r => r.json()).then(d => setMaterials(d)).catch(console.error);
    }

    const p = PERSONA_MAP[selectedTheme] ?? { name: 'Alex', emoji: '👨‍🏫' };
    const welcome = freeTalk
      ? `Hello! I'm Chris, your conversation partner. What would you like to talk about today?`
      : selectedLevel === 'Beginner'
        ? `Hello! I'm ${p.name}. Today we talk about ${selectedTheme}. Are you ready?`
        : `Hello! I'm ${p.name}. We're practicing "${selectedTheme}" today. Ready to begin?`;

    setMessages([{ role: 'assistant', content: welcome }]);
    const r = selectedLevel === 'Beginner' ? 0.8 : selectedLevel === 'Intermediate' ? 1.0 : 1.1;
    speak(welcome, 'en-US', r);
  };

  // ── End session ──────────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    try { recognitionRef.current?.stop(); } catch (_) {}
    synthRef.current?.cancel(); stopAllAnimations(); setIsActive(false); setStatus('idle');
    const mins  = Math.round((Date.now() - sessionStartRef.current) / 60000);
    const turns = messagesRef.current.filter(m => m.role === 'user').length;
    saveProgress(turns, mins);
    setIsLoadingSummary(true); setShowSummary(true); setSummaryData(null);
    try {
      const res  = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesRef.current, level: levelRef.current, theme: themeRef.current }) });
      setSummaryData(await res.json());
    } catch (_) { } finally { setIsLoadingSummary(false); }
  };

  const handleKeepLearning = () => {
    setShowSummary(false); setSummaryData(null); setStep('select-level'); setLevel(null);
    setTheme(''); setCustomTheme(''); setShowCustomInput(false);
    setMessages([{ role: 'assistant', content: "Hello! I'm your AI English Teacher. Choose your level to start." }]);
    setTimeLeft(1800); setIsActive(false); setStatus('idle');
    setMaterials(null); setTranslation(null); setStatusMessage(''); setTranscript('');
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!mounted) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100">

      {/* ── Summary Modal ── */}
      {showSummary && (
        <SummaryModal
          data={summaryData} isLoading={isLoadingSummary}
          level={level ?? ''} theme={theme} progress={progress}
          onKeepLearning={handleKeepLearning}
          onEnd={() => window.location.reload()}
        />
      )}

      {/* ── Top Bar ── */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-3 px-4">
        {/* Progress stats */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{progress.lastSessionDate === new Date().toDateString() ? '🔥' : '💤'}</span>
            <div>
              <div className="text-xs font-bold text-slate-200 leading-none">{progress.streak}</div>
              <div className="text-[9px] text-slate-500 leading-none">streak</div>
            </div>
          </div>
          <div className="w-px h-5 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg">📚</span>
            <div>
              <div className="text-xs font-bold text-slate-200 leading-none">{progress.totalSessions}</div>
              <div className="text-[9px] text-slate-500 leading-none">sessions</div>
            </div>
          </div>
        </div>
        {/* Timer */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className={`text-xl font-mono font-bold ${timeLeft < 300 ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          STEP 1: SELECT LEVEL
      ══════════════════════════════════════════════════════════ */}
      {step === 'select-level' && (
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur border border-slate-800 rounded-3xl p-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              English Voice Coach
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Choose your English level to begin</p>
          </div>
          <div className="flex flex-col gap-3">
            {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl, i) => {
              const meta = [
                { emoji: '🌱', desc: 'Simple words & short sentences' },
                { emoji: '🌿', desc: 'Natural conversations' },
                { emoji: '🌳', desc: 'Complex topics & idioms' },
              ][i];
              return (
                <button key={lvl} onClick={() => { setLevel(lvl); setStep('select-theme'); }}
                  className="w-full py-4 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 transition-all text-left flex items-center gap-4 group">
                  <span className="text-2xl">{meta.emoji}</span>
                  <div>
                    <div className="font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">{lvl}</div>
                    <div className="text-xs text-slate-500">{meta.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-800">
            <p className="text-slate-600 text-xs mb-3">Or jump straight in</p>
            <button onClick={() => { setLevel('Intermediate'); startLesson('Intermediate', 'Free Talk', true); }}
              className="w-full py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 font-bold text-emerald-400 transition-all text-sm">
              💬 Free Talk — Any topic
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STEP 2: SELECT THEME
      ══════════════════════════════════════════════════════════ */}
      {step === 'select-theme' && level && (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
          <div className="text-center">
            <button onClick={() => setStep('select-level')} className="text-slate-500 hover:text-slate-300 text-sm mb-3 transition-colors">← Back</button>
            <h2 className="text-xl font-bold">Choose a Topic</h2>
            <p className="text-slate-500 text-sm mt-1">{level} level · Pick your scenario</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-h-[52vh] overflow-y-auto pr-1">
            {THEMES.map(t => (
              <button key={t.label} onClick={() => startLesson(level, t.label)}
                className="py-3 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition-all text-left flex items-center gap-2.5 group">
                <span className="text-xl">{t.emoji}</span>
                <span className="text-xs font-medium text-slate-300 group-hover:text-indigo-300 leading-tight transition-colors">{t.label}</span>
              </button>
            ))}

            {/* Custom Theme */}
            <button onClick={() => setShowCustomInput(p => !p)}
              className="py-3 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-indigo-500/50 transition-all text-left flex items-center gap-2.5 group">
              <span className="text-xl">✏️</span>
              <span className="text-xs font-medium text-slate-400 group-hover:text-indigo-300 leading-tight transition-colors">Custom Topic</span>
            </button>
          </div>

          {showCustomInput && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                type="text" value={customTheme} onChange={e => setCustomTheme(e.target.value)}
                placeholder="e.g. Negotiating a raise..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                onKeyDown={e => { if (e.key === 'Enter' && customTheme.trim()) startLesson(level, customTheme.trim()); }}
              />
              <button
                onClick={() => { if (customTheme.trim()) startLesson(level, customTheme.trim()); }}
                disabled={!customTheme.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl font-bold text-sm transition-all">
                Go →
              </button>
            </div>
          )}

          <button onClick={() => startLesson(level, 'Free Talk', true)}
            className="w-full py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 font-bold text-emerald-400 transition-all text-sm">
            💬 Free Talk instead
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STEP 3: SESSION
      ══════════════════════════════════════════════════════════ */}
      {step === 'session' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 animate-in fade-in duration-500">

          {/* ─ Audio Visualizer ─ */}
          <div className="relative w-56 h-56 flex items-center justify-center">
            {ringRefs.map((ref, i) => (
              <div key={i} ref={ref}
                className="absolute rounded-full border-2 border-indigo-400"
                style={{ width: `${64 + i * 36}px`, height: `${64 + i * 36}px`, opacity: 0.08, transition: 'opacity 0.3s ease' }}
              />
            ))}
            <div className={`w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex flex-col items-center justify-center shadow-2xl shadow-indigo-500/30 z-10 transition-transform duration-150 ${status === 'speaking' ? 'scale-110' : ''}`}>
              <span className="text-4xl">{persona.emoji}</span>
              <span className="text-[9px] text-indigo-200 mt-1 font-medium tracking-wide">{persona.name}</span>
            </div>
          </div>

          {/* ─ Level + Caption ─ */}
          <div className="text-center space-y-2 px-4 w-full">
            <h3 className="text-sm font-medium text-indigo-400 uppercase tracking-widest">{level} · {theme}</h3>

            <div className="bg-slate-900/60 rounded-2xl p-5 min-h-[6rem] flex items-center justify-center border border-slate-800 shadow-inner relative group">
              <p className="text-slate-200 text-lg leading-relaxed font-medium text-center">
                {status === 'processing' ? (
                  <span className="flex gap-1 justify-center">
                    {[0,1,2].map(i => <span key={i} className="animate-bounce" style={{ animationDelay: `${i*0.2}s` }}>.</span>)}
                  </span>
                ) : status === 'speaking' ? (currentCaption || messages.at(-1)?.content)
                  : status === 'listening' ? (transcript || 'Listening...')
                  : messages.at(-1)?.role === 'assistant' ? messages.at(-1)!.content
                  : 'Tap the mic to speak'}
              </p>

              {/* Replay buttons */}
              {status === 'idle' && messages.some(m => m.role === 'assistant') && (
                <div className="absolute -right-2 -top-2 flex gap-1">
                  <button onClick={() => replayLast(false)} title="Replay"
                    className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={() => replayLast(true)} title="Slow replay"
                    className="bg-amber-600 hover:bg-amber-500 p-2 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Translation — inline block, pushes content below it down */}
            {(translation || isTranslating) && (
              <div className="mt-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-sm text-indigo-300 italic text-center">
                  {isTranslating ? (
                    <span className="flex items-center justify-center gap-2">
                      {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />)}
                      Translating...
                    </span>
                  ) : (
                    <><span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-50">Translation</span>{translation}</>
                  )}
                </p>
              </div>
            )}

            {statusMessage && <p className="text-indigo-500/60 text-xs font-mono animate-pulse">{statusMessage}</p>}
          </div>

          {/* ─ Materials ─ */}
          {materials && (
            <div className="w-full bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 space-y-3 text-left">
              <div>
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Vocabulary</h4>
                <div className="flex flex-wrap gap-1.5">
                  {materials.vocabulary.map((v, i) => <span key={i} className="px-2 py-1 bg-slate-800 rounded-lg text-xs border border-slate-700">{v}</span>)}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5">Key Phrases</h4>
                <ul className="text-xs text-slate-300 space-y-1">
                  {materials.phrases.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              </div>
              {materials.responses && materials.responses.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5">How to Respond</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {materials.responses.map((r, i) => (
                      <button key={i} onClick={() => handleResponseHint(r)}
                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-xs border border-amber-500/30 transition-all">{r}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Response Hints (silence) ─ */}
          {showResponseHints && responseHints.length > 0 && (
            <div className="w-full bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Need help responding?</h4>
              <div className="flex flex-wrap gap-2">
                {responseHints.map((h, i) => (
                  <button key={i} onClick={() => handleResponseHint(h)}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-sm border border-amber-500/40 transition-all">{h}</button>
                ))}
              </div>
              <button onClick={() => setShowResponseHints(false)} className="text-xs text-slate-600 hover:text-slate-400 mt-1">Dismiss</button>
            </div>
          )}

          {/* ─ Help Phrases ─ */}
          {showHelp && (
            <div className="w-full bg-slate-900/60 border border-slate-700 rounded-2xl p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Need Help?</h4>
              {HELP_PHRASES.map((ph, i) => (
                <button key={i} onClick={() => handleHelpPhrase(ph)}
                  className="w-full text-left p-2.5 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl transition-all border border-slate-700/50 hover:border-amber-500/40">
                  <p className="text-sm text-slate-200">{ph.text}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{ph.zh}</p>
                </button>
              ))}
            </div>
          )}

          {/* ─ Controls ─ */}
          <div className="flex flex-col items-center gap-5 w-full px-4 pb-2">
            <div className="flex items-center gap-5">
              {/* Help */}
              <button onClick={() => setShowHelp(p => !p)}
                disabled={status === 'processing' || status === 'speaking'}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg text-xl font-bold disabled:opacity-40 ${showHelp ? 'bg-amber-500 shadow-amber-500/30' : 'bg-slate-800 hover:bg-slate-700'}`}
                title="Help phrases">?</button>

              {/* Mic */}
              <button onClick={toggleListening}
                disabled={status === 'processing' || status === 'speaking'}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl disabled:opacity-40 ${
                  status === 'listening' ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/40' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40'
                }`}>
                {status === 'listening' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            </div>

            <button onClick={handleEndSession}
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium uppercase tracking-widest">
              End Session
            </button>

            <p className="text-[10px] text-slate-600 uppercase tracking-widest">
              {status === 'listening' ? 'Release your thoughts...' : 'Press to start speaking'}
            </p>
          </div>
        </div>
      )}

      {/* Version badge */}
      <div className="fixed bottom-4 right-4 px-3 py-1 bg-white/5 rounded-full text-[10px] font-mono text-slate-600 pointer-events-none">
        v2.0.0
      </div>
    </main>
  );
}
