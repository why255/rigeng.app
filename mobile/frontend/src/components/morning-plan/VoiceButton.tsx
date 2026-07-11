/**
 * VoiceButton — 语音录制按钮（腾讯云ASR 在线转写 + 离线录音双模式）。
 * 纯 BEM 类名 + 内联 style，无 Tailwind。
 *
 * - 在线模式 (offline=false): getUserMedia → MediaRecorder → 腾讯云 ASR → onTranscript(text)
 * - 离线模式 (offline=true):  getUserMedia → MediaRecorder → IndexedDB → onRecordingStored(recording)
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { storeRecording, type OfflineRecording } from '@/shared/utils/offlineRecordingsDB';
import { speechToText } from '@/shared/api/voice';

export type VoiceMode = 'hold' | 'click';

export interface VoiceButtonProps {
  mode?: VoiceMode;
  offline?: boolean;
  onTranscript?: (text: string) => void;
  onRecordingStored?: (recording: OfflineRecording) => void;
  className?: string;
}

/* ── Component ── */

export function VoiceButton({ mode = 'hold', offline = false, onTranscript, onRecordingStored, className = '' }: VoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pressStartYRef = useRef<number>(0);

  const MAX_RECORDING_SECONDS = 60;  // 超过60s自动停止，避免Base64音频超Nginx 10M限制

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setRecording(false); setCancelZone(false); setElapsed(0);
  }, []);

  useEffect(() => { return cleanup; }, [cleanup]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now(); setElapsed(0);
    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(sec);
      // 达到最大时长自动停止（正常发送，不取消）
      if (sec >= MAX_RECORDING_SECONDS) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecording(false);
        // onstop 回调会自动发送 ASR 请求
      }
    }, 200);
  }, []);

  /* ── 在线模式: getUserMedia + MediaRecorder → 腾讯云 ASR ── */
  const startOnlineRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data?.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); streamRef.current = null;
        if (cancelZone) { audioChunksRef.current = []; return; }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        if (audioBlob.size < 500) return;

        try {
          const result = await speechToText(audioBlob);
          if (result.text?.trim()) {
            onTranscript?.(result.text.trim());
          }
        } catch {
          // ASR 失败静默处理
        }
      };

      recorder.onerror = () => { cleanup(); };
      recorder.start(100);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在设置中允许麦克风访问后重试'
        : '录音启动失败，请检查设备权限后重试';
      alert(msg);
      cleanup();
    }
  }, [cancelZone, cleanup, onTranscript]);

  /* ── 离线模式: getUserMedia + MediaRecorder → IndexedDB ── */
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
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在设置中允许麦克风访问后重试'
        : '录音启动失败，请检查设备权限后重试';
      alert(msg);
      cleanup();
    }
  }, [cancelZone, cleanup, onRecordingStored]);

  /* ── 通用录制控制 ── */
  const startRecording = useCallback(() => {
    setRecording(true); setCancelZone(false); startTimer();
    offline ? startOfflineRecording() : startOnlineRecording();
  }, [offline, startTimer, startOfflineRecording, startOnlineRecording]);

  const stopRecording = useCallback((cancelled = false) => {
    if (!recording) return; setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (cancelled || cancelZone) { cleanup(); return; }
    if (offline) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    }
  }, [recording, cancelZone, offline, cleanup]);

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
