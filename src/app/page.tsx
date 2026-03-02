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
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800);
  const [isActive, setIsActive] = useState(false);
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | null>(null);
  const [theme, setTheme] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [materials, setMaterials] = useState<{ vocabulary: string[], phrases: string[] } | null>(null);

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

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { themeRef.current = theme; }, [theme]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcriptValue = event.results[current][0].transcript;
          setTranscript(transcriptValue);

          if (event.results[current].isFinal) {
            handleVoiceInput(transcriptValue);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            alert("Microphone access denied. Please enable it in your browser settings.");
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
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
    synthRef.current.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    // Adjust rate based on level
    utterance.rate = level === 'Beginner' ? 0.8 : level === 'Intermediate' ? 1.0 : 1.1;
    synthRef.current.speak(utterance);
  };

  const handleVoiceInput = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setTranscript('');
    setIsLoading(true);

    try {
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
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
      speak(data.content);
    } catch (error) {
      console.error(error);
      speak("I'm sorry, I'm having trouble connecting. Could you say that again?");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const startLesson = async (selectedLevel: 'Beginner' | 'Intermediate' | 'Advanced') => {
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    setLevel(selectedLevel);
    setTheme(randomTheme);
    setIsActive(true);
    setIsLoading(true);

    // Fetch Materials
    try {
      const matRes = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel, theme: randomTheme }),
      });
      const matData = await matRes.json();
      setMaterials(matData);
    } catch (e) {
      console.error("Failed to load materials");
    }

    const welcomeText = `Hello! We've started your ${selectedLevel} session. Today's theme is: ${randomTheme}. I've prepared some helpful vocabulary and phrases for you on the screen. Ready? Let's start!`;
    setMessages([{ role: 'assistant', content: welcomeText }]);

    // Unlock audio for mobile (iOS/Android)
    if (synthRef.current) {
      const unlockUtterance = new SpeechSynthesisUtterance(' ');
      unlockUtterance.volume = 0;
      synthRef.current.speak(unlockUtterance);
    }

    speak(welcomeText);
    setIsLoading(false);
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
            <div className={`absolute w-full h-full rounded-full bg-indigo-500/20 animate-ping ${isLoading ? 'block' : 'hidden'}`} />
            <div className={`absolute w-full h-full rounded-full border-4 border-indigo-500/30 ${isListening ? 'animate-pulse scale-110' : ''}`} />
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <span className="text-4xl">👨‍🏫</span>
            </div>
          </div>

          <div className="text-center space-y-2 px-4">
            <h3 className="text-xl font-medium text-indigo-400">{level} Level</h3>
            <p className="text-slate-300 text-lg leading-relaxed min-h-[4rem]">
              {isLoading ? "Teacher is thinking..." : (isListening ? (transcript || "Listening...") : "Tap the mic to speak")}
            </p>
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
                disabled={isLoading}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${isListening
                  ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40'
                  } disabled:opacity-50`}
              >
                {isListening ? (
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

            {/* Real-time Subtitles (Small) */}
            <div className="w-full glass-effect p-4 text-xs text-slate-500 flex flex-col gap-2 italic">
              <p>Last response: {messages[messages.length - 1]?.content.substring(0, 50)}...</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
