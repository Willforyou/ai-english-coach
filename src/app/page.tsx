"use client";

import { useState, useEffect, useRef } from 'react';

// For browser environment where SpeechRecognition might not be in the global scope
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function Home() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: "Hello! I'm your AI English Teacher. Are you ready for our 30-minute voice session? Please choose your level to start the call." }
  ]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(1800);
  const [isActive, setIsActive] = useState(false);
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | null>(null);
  const [theme, setTheme] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [materials, setMaterials] = useState<{ vocabulary: string[], phrases: string[] } | null>(null);

  const pendingTranscriptRef = useRef<string>('');

  const themes = [
    "Coffee Shop Ordering",
    "Job Interview",
    "Airport Check-in",
    "Doctor Appointment",
    "Lost in London",
    "Business Negotiation",
    "Talking about Hobbies",
    "Ordering at a Restaurant",
    "Asking for Directions",
    "Check-in at a Hotel"
  ];

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Refs to avoid stale closures in event listeners
  const messagesRef = useRef(messages);
  const levelRef = useRef(level);
  const themeRef = useRef(theme);
  const statusRef = useRef(status);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        // Set continuous mode based on level - Beginner needs it to avoid auto-stop
        recognitionRef.current.continuous = levelRef.current === 'Beginner';
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; ++i) {
            currentText += event.results[i][0].transcript;
          }
          setTranscript(currentText);
          pendingTranscriptRef.current = currentText;
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          setStatusMessage(`Error: ${event.error}`);
          setStatus('idle');
        };

        recognitionRef.current.onend = () => {
          const finalPrompt = pendingTranscriptRef.current;
          if (finalPrompt && finalPrompt.trim()) {
            handleVoiceInput(finalPrompt.trim());
            pendingTranscriptRef.current = '';
          } else {
            setStatus('idle');
            setStatusMessage('');
          }
        };
      }
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      speak("Time is up! You did a fantastic job today. Let's finish here.");
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const speak = (text: string) => {
    if (!synthRef.current) return;

    // Stop recognition before speaking to prevent iOS conflicts
    if (status === 'listening') {
      recognitionRef.current?.stop();
    }

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = levelRef.current === 'Beginner' ? 0.8 : levelRef.current === 'Intermediate' ? 1.0 : 1.1;

    utterance.onend = () => {
      setStatus('idle');
    };

    synthRef.current.speak(utterance);
  };

  const handleVoiceInput = async (text: string) => {
    if (!text.trim()) {
      setStatus('idle');
      return;
    }

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setTranscript('');
    setStatus('processing');
    setStatusMessage('Analyzing your voice...');

    try {
      setStatusMessage('Talking to AI Teacher...');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMessage],
          level: levelRef.current,
          theme: themeRef.current
        }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const content = data.content || '';
      setStatusMessage('AI is responding...');
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
      speak(content);
    } catch (error: any) {
      console.error(error);
      setStatusMessage(`Error: ${error.message}`);
      speak("I'm sorry, I encountered an error. Please try again.");
    }
  };

  const replayLastMessage = () => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMessage) {
      setStatus('speaking');
      speak(lastAssistantMessage.content);
    }
  };

  const toggleListening = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
      setStatusMessage('Processing your words...');
      // In continuous mode, handleVoiceInput will be called by onend
      // This button click just triggers that stop.
    } else if (status === 'idle') {
      if (!recognitionRef.current) {
        alert("Speech Recognition is not supported. Please use Safari on iOS.");
        return;
      }

      // Dynamic update of continuous mode based on current level
      recognitionRef.current.continuous = levelRef.current === 'Beginner';

      setTranscript('');
      pendingTranscriptRef.current = '';
      try {
        recognitionRef.current.start();
        setStatus('listening');
        setStatusMessage(levelRef.current === 'Beginner' ? 'Listening (Continuous Mode)...' : 'Listening...');
      } catch (e) {
        console.error(e);
        setStatus('idle');
      }
    }
  };

  const startLesson = async (selectedLevel: 'Beginner' | 'Intermediate' | 'Advanced') => {
    // 1. IMMEDIATE SYNCHRONOUS AUDIO UNLOCK
    if (synthRef.current) {
      const unlockUtterance = new SpeechSynthesisUtterance(' ');
      unlockUtterance.volume = 0;
      synthRef.current.speak(unlockUtterance);
    }

    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    setLevel(selectedLevel);
    setTheme(randomTheme);
    setIsActive(true);
    setStatus('processing');

    try {
      const matRes = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel, theme: randomTheme }),
      });
      const matData = await matRes.json();
      setMaterials(matData);
    } catch (e) {
      console.error(e);
    }

    const welcomeText = selectedLevel === 'Beginner'
      ? `Hello! Today we talk about ${randomTheme}. Are you ready?`
      : `Hello! I've prepared some helpful materials for this ${selectedLevel} session. Today's theme is ${randomTheme}. Ready?`;

    setMessages([{ role: 'assistant', content: welcomeText }]);
    speak(welcomeText);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-100">
      {/* Timer Bar */}
      <div className="w-full max-w-md flex justify-between items-center mb-8 glass-effect p-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          <span className="font-bold text-sm tracking-widest uppercase">Live Session</span>
        </div>
        <div className={`text-2xl font-mono ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {!level ? (
        <div className="w-full max-w-md glass-effect p-8 text-center space-y-6">
          <h2 className="text-3xl font-bold">English Voice Coach</h2>
          <p className="text-slate-400">Choose your level to start the phone call conversation.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => startLesson('Beginner')} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all font-bold text-lg">Beginner</button>
            <button onClick={() => startLesson('Intermediate')} className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700 font-bold text-lg">Intermediate</button>
            <button onClick={() => startLesson('Advanced')} className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700 font-bold text-lg">Advanced</button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          {/* Avatar / Visualizer */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <div className={`absolute w-full h-full rounded-full bg-indigo-500/20 animate-ping ${status === 'processing' || status === 'speaking' ? 'block' : 'hidden'}`} />
            <div className={`absolute w-full h-full rounded-full border-4 border-indigo-500/30 ${status === 'listening' ? 'animate-pulse scale-110' : ''}`} />
            <div className={`w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20 ${status === 'speaking' ? 'scale-105' : ''}`}>
              <span className="text-4xl">👨‍🏫</span>
            </div>
          </div>

          <div className="text-center space-y-2 px-4 w-full">
            <h3 className="text-xl font-medium text-indigo-400">{level} Level</h3>

            {/* Teacher Transcription Area */}
            <div className="bg-slate-900/50 rounded-2xl p-6 min-h-[6rem] flex items-center justify-center border border-slate-800 shadow-inner group relative">
              <p className="text-slate-200 text-lg md:text-xl leading-relaxed font-medium">
                {status === 'processing' ? (
                  <span className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce [animation-delay:0.2s]">.</span>
                    <span className="animate-bounce [animation-delay:0.4s]">.</span>
                  </span>
                ) :
                  status === 'speaking' ? messages[messages.length - 1]?.content :
                    status === 'listening' ? (transcript || "Listening...") :
                      messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1].content : "Tap the mic to speak"}
              </p>

              {/* Replay Button Overlay */}
              {status === 'idle' && messages.some(m => m.role === 'assistant') && (
                <button
                  onClick={replayLastMessage}
                  className="absolute -right-2 -top-2 bg-indigo-600 hover:bg-indigo-500 p-2 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
                  title="Replay last message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {statusMessage && (
              <p className="text-indigo-500/60 text-xs font-mono animate-pulse">
                {statusMessage}
              </p>
            )}
          </div>

          {/* Call Controls & Materials */}
          <div className="flex flex-col items-center gap-6 w-full px-4">
            {materials && (
              <div className="w-full glass-effect p-4 space-y-3 bg-indigo-500/5 border-indigo-500/20 text-left">
                <div>
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Vocabulary</h4>
                  <div className="flex flex-wrap gap-2">
                    {materials?.vocabulary?.length > 0 ? materials.vocabulary.map((v: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700">{v}</span>
                    )) : <span className="text-slate-500 text-xs italic">No vocabulary found</span>}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Key Phrases</h4>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {materials?.phrases?.length > 0 ? materials.phrases.map((p: string, i: number) => (
                      <li key={i}>• {p}</li>
                    )) : <li className="text-slate-500 italic">No phrases found</li>}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-6 w-full px-8">
              <button
                onClick={toggleListening}
                disabled={status === 'processing' || status === 'speaking'}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${status === 'listening'
                  ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40'
                  } disabled:opacity-50`}
              >
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

              <button onClick={() => window.location.reload()} className="text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium uppercase tracking-widest">
                End Session
              </button>
            </div>

            {/* Voice Guidance Note */}
            <div className="w-full text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                {status === 'listening' ? "Release your thoughts..." : "Press to start speaking"}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="fixed bottom-4 right-4 px-3 py-1 bg-white/10 rounded-full text-[10px] font-mono text-slate-500 pointer-events-none">
        v1.0.3 (Liquid-1.2B)
      </div>
    </main>
  );
}
