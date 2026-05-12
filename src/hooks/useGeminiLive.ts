"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

// Gemini Multimodal Live API uses PCM 16-bit Little Endian, 16kHz
const SAMPLE_RATE = 16000;

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveProps {
  apiKey: string;
  systemInstruction: string;
  onAudioData?: (base64: string) => void;
  onTextData?: (text: string) => void;
  onVolumeChange?: (volume: number) => void;
  onInterrupted?: () => void;
}

export function useGeminiLive({
  apiKey,
  systemInstruction,
  onAudioData,
  onTextData,
  onVolumeChange,
  onInterrupted
}: UseGeminiLiveProps) {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  // --- Audio Setup ---
  const initAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const stopAudio = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    audioWorkletRef.current?.disconnect();
    audioContextRef.current?.close();
    audioContextRef.current = null;
    isPlayingRef.current = false;
    audioQueue.current = [];
  };

  // --- WebSocket Setup ---
  const connect = useCallback(async () => {
    if (!apiKey) {
      setError("API Key is missing");
      return;
    }

    setStatus('connecting');
    setError(null);

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    try {
      await initAudio();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Gemini Live Connected, waiting 500ms before setup...");
        
        // Small delay to ensure stability
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          
          setStatus('connected');
          const setupMessage = {
            setup: {
              model: "models/gemini-2.0-flash-exp",
              generation_config: {
                response_modalities: ["audio"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: "Puck"
                    }
                  }
                }
              }
            }
          };
          
          console.log("Sending Setup Message:", setupMessage);
          wsRef.current.send(JSON.stringify(setupMessage));
        }, 500);
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("Gemini Live Message:", data);
        
        if (data.setupComplete) {
          console.log("Setup Complete, starting recording...");
          startRecording();
          return;
        }

        if (data.serverContent) {
          const { modelTurn, interrupted } = data.serverContent;
          
          if (interrupted) {
            console.log("AI Interrupted");
            audioQueue.current = [];
            isPlayingRef.current = false;
            onInterrupted?.();
          }

          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData) {
                const base64Audio = part.inlineData.data;
                onAudioData?.(base64Audio);
                playAudioChunk(base64Audio);
              }
              if (part.text) {
                onTextData?.(part.text);
              }
            }
          }
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error:", e);
        setError("WebSocket Connection Error");
        setStatus('error');
      };

      ws.onclose = () => {
        console.log("Gemini Live Disconnected");
        setStatus('idle');
      };

      // Recording will start on data.setupComplete in onmessage

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setStatus('error');
    }
  }, [apiKey, systemInstruction]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    stopAudio();
    setStatus('idle');
  }, []);

  // --- Audio Recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current!.destination);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = convertFloat32ToInt16(inputData);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          
          wsRef.current.send(JSON.stringify({
            realtime_input: {
              media_chunks: [{
                mime_type: "audio/pcm;rate=16000",
                data: base64
              }]
            }
          }));

          // Calculate volume for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
          const volume = Math.sqrt(sum / inputData.length);
          onVolumeChange?.(volume);
        }
      };
    } catch (err) {
      console.error("Recording Error:", err);
    }
  };

  // --- Audio Playback ---
  const playAudioChunk = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcmData = new Int16Array(bytes.buffer);
    
    audioQueue.current.push(pcmData);
    if (!isPlayingRef.current) {
      processQueue();
    }
  };

  const processQueue = async () => {
    if (audioQueue.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const pcmData = audioQueue.current.shift()!;
    const float32Data = convertInt16ToFloat32(pcmData);
    
    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32Data);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      processQueue();
    };
    source.start();
  };

  // --- Helpers ---
  const convertFloat32ToInt16 = (buffer: Float32Array) => {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      buf[i] = Math.min(1, buffer[i]) * 0x7FFF;
    }
    return buf;
  };

  const convertInt16ToFloat32 = (buffer: Int16Array) => {
    const l = buffer.length;
    const buf = new Float32Array(l);
    for (let i = 0; i < l; i++) {
      buf[i] = buffer[i] / 0x7FFF;
    }
    return buf;
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    error,
    isSpeaking,
    connect,
    disconnect,
  };
}
