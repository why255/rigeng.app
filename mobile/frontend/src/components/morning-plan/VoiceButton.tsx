/**
 * VoiceButton — 语音录制按钮（Web Speech API + MediaRecorder 双模式）。
 * 纯 BEM 类名 + 内联 style，无 Tailwind。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { storeRecording, type OfflineRecording } from '@/shared/utils/offlineRecordingsDB';

export type VoiceMode = 'hold' | 'click';

export interface VoiceButtonProps {
  mode?: VoiceMode;
  offline?: boolean;
  onTranscript?: (text: string) => void;
  onRecordingStored?: (recording: OfflineRecording) => void;
  className?: string;
}

export function VoiceButton({ mode = 'hold', offline = false, onTranscript, onRecordingStored, className = '' }: VoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pressStartYRef = useRef<number>(0);
  const transcriptRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setRecording(false); setCancelZone(false); setElapsed(0);
  }, []);

  useEffect(() => { return cleanup; }, [cleanup]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now(); setElapsed(0);
    timerRef.current = setInterval(() => { setElapsed((Date.now() - startTimeRef.current) / 1000); }, 200);
  }, []);

  const startOnlineRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('浏览器不支持语音识别'); return; }
    transcriptRef.current = '';
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcriptRef.current += event.results[i][0].transcript;
      }
    };
    recognition.onend = () => { if (recording) { try { recognition.start(); } catch { /* */ } } };
    recognitionRef.current = recognition;
    recognition.start();
  }, [recording]);

  const startOfflineRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; audioChunksRef.current = [];
      const mimeType = ['audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); streamRef.current = null;
        if (audioChunksRef.current.length > 0 && !cancelZone) {
          const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
          const id = await storeRecording(blob, (Date.now() - startTimeRef.current) / 1000);
          onRecordingStored?.({ id, timestamp: Date.now(), duration: (Date.now() - startTimeRef.current) / 1000, blob });
        }
        audioChunksRef.current = []; mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
    } catch { cleanup(); }
  }, [cancelZone, cleanup, onRecordingStored]);

  const startRecording = useCallback(() => {
    setRecording(true); setCancelZone(false); startTimer();
    offline ? startOfflineRecording() : startOnlineRecognition();
  }, [offline, startTimer, startOfflineRecording, startOnlineRecognition]);

  const stopRecording = useCallback((cancelled = false) => {
    if (!recording) return; setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (cancelled || cancelZone) { cleanup(); return; }
    if (offline) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    } else {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* */ } }
      const text = transcriptRef.current.trim();
      if (text) onTranscript?.(text);
    }
    cleanup();
  }, [recording, cancelZone, offline, cleanup, onTranscript]);

  const formatTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  return (
    <div className={`mp-voice-wrap ${className}`}>
      {recording && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <button
            className={cancelZone ? 'mp-voice-cancel mp-voice-cancel--active' : 'mp-voice-cancel'}
            onClick={() => stopRecording(true)}
          >
            取消
          </button>
        </div>
      )}
      <div
        className={recording ? 'mp-voice-btn mp-voice-btn--recording' : 'mp-voice-btn mp-voice-btn--idle'}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); if (!recording && mode === 'hold') startRecording(); pressStartYRef.current = e.clientY; }}
        onPointerUp={() => { if (recording && mode === 'hold') stopRecording(cancelZone); }}
        onPointerMove={(e) => { if (recording && mode === 'hold') setCancelZone(pressStartYRef.current - e.clientY > 80); }}
        onClick={() => { if (mode === 'click') recording ? stopRecording(false) : startRecording(); }}
      >
        {!recording && (
          <>
            <div className="mp-voice-pulse" style={{ animation: 'mpVoicePulse 1.8s infinite' }} />
            <div className="mp-voice-pulse mp-voice-pulse--delay" />
          </>
        )}
        <Icon icon="mingcute:mic-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
      </div>
      {recording && <div className="mp-voice-timer">{formatTime(elapsed)}</div>}
    </div>
  );
}
