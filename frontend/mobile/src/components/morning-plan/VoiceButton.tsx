/**
 * VoiceButton — 语音录制按钮组件。
 * 支持在线 (Web Speech API) 和离线 (MediaRecorder + IndexedDB) 两种模式。
 * 支持「按住说话」和「点击说话」两种交互方式。
 * 对齐 m1-p2.html / m1-p5.html 中大语音按钮设计。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { storeRecording, type OfflineRecording } from '@rigeng/shared/utils/offlineRecordingsDB';

export type VoiceMode = 'hold' | 'click';

export interface VoiceButtonProps {
  mode?: VoiceMode;
  offline?: boolean;
  onTranscript?: (text: string) => void;
  onRecordingStored?: (recording: OfflineRecording) => void;
  className?: string;
}

export function VoiceButton({
  mode = 'hold',
  offline = false,
  onTranscript,
  onRecordingStored,
  className = '',
}: VoiceButtonProps) {
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

  // ── 清理 ────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setCancelZone(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ── 计时器 ──────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      const sec = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(sec);
      if (sec >= 60) stopRecording();
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── 在线：Web Speech API ────────────────────────────
  const startOnlineRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }
    transcriptRef.current = '';
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript;
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.warn('语音错误', e.error);
      if (e.error === 'not-allowed') alert('请允许麦克风权限');
      stopRecording(true);
    };

    recognition.onend = () => {
      if (recording) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [recording]);

  // ── 离线：MediaRecorder ──────────────────────────────
  const startOfflineRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/wav'];
      let mimeType = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (audioChunksRef.current.length > 0 && !cancelZone) {
          const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
          const duration = (Date.now() - startTimeRef.current) / 1000;
          const recording: OfflineRecording = { blob, timestamp: Date.now(), duration };
          await storeRecording(blob, duration);
          onRecordingStored?.(recording);
        }
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
    } catch (err: any) {
      console.error('获取麦克风失败:', err);
      if (err.name === 'NotAllowedError') {
        alert('请允许麦克风权限以使用语音功能');
      } else {
        alert('无法访问麦克风，请检查设备设置');
      }
      cleanup();
    }
  }, [cancelZone, onRecordingStored, cleanup]);

  // ── 开始/停止录音 ──────────────────────────────────
  const startRecording = useCallback(() => {
    setRecording(true);
    setCancelZone(false);
    startTimer();
    if (offline) {
      startOfflineRecording();
    } else {
      startOnlineRecognition();
    }
  }, [offline, startTimer, startOfflineRecording, startOnlineRecognition]);

  const stopRecording = useCallback((cancelled = false) => {
    if (!recording) return;
    setRecording(false);
    stopTimer();

    if (cancelled || cancelZone) {
      cleanup();
      return;
    }

    if (offline) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      const text = transcriptRef.current.trim();
      if (text) onTranscript?.(text);
    }
    cleanup();
  }, [recording, cancelZone, offline, stopTimer, cleanup, onTranscript]);

  // ── 触摸/鼠标事件 ──────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (recording) return;
    if (e.clientY) pressStartYRef.current = e.clientY;
    if (mode === 'hold') startRecording();
  }, [recording, mode, startRecording]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!recording) return;
    if (mode === 'hold') stopRecording(cancelZone);
  }, [recording, mode, stopRecording, cancelZone]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!recording || mode !== 'hold') return;
    if (e.clientY) {
      // 向上滑动超过 80px 进入取消区域
      const delta = pressStartYRef.current - e.clientY;
      setCancelZone(delta > 80);
    }
  }, [recording, mode]);

  // ── 点击模式切换 ────────────────────────────────────
  const handleClick = useCallback(() => {
    if (mode !== 'click') return;
    if (recording) {
      stopRecording(false);
    } else {
      startRecording();
    }
  }, [mode, recording, startRecording, stopRecording]);

  // ── 格式化时间 ──────────────────────────────────────
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const modeHint = mode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* 取消按钮（录音时显示） */}
      {recording && (
        <div className="flex justify-center mb-2">
          <button
            className={`px-[18px] py-1.5 rounded-[30px] text-[13px] font-medium border shadow-sm transition-all ${
              cancelZone
                ? 'bg-[#C03A39] text-white border-[#C03A39]'
                : 'bg-white text-[#C03A39] border-[#F1D5C7]'
            }`}
            onClick={() => stopRecording(true)}
          >
            取消
          </button>
        </div>
      )}

      {/* 大语音按钮 */}
      <div
        className={`w-[72px] h-[72px] rounded-full flex items-center justify-center cursor-pointer transition-all select-none relative ${
          recording ? 'bg-[#A0302E]' : 'bg-[#C03A39]'
        } ${recording ? 'shadow-[0_10px_40px_rgba(192,58,57,0.7)]' : 'shadow-[0_10px_25px_rgba(192,58,57,0.4)]'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerCancel={() => stopRecording(true)}
        onClick={handleClick}
      >
        {/* 脉冲动画圈 */}
        {!recording && (
          <>
            <div className="absolute inset-0 rounded-full bg-[rgba(192,58,57,0.2)] animate-[pulse_1.8s_infinite]" />
            <div className="absolute inset-0 rounded-full bg-[rgba(192,58,57,0.2)] animate-[pulse_1.8s_infinite_0.6s]" />
          </>
        )}
        <Icon icon="solar:microphone-bold" className="text-3xl text-white relative z-10" />
      </div>

      {/* 录音时长 */}
      {recording && (
        <div className="text-[13px] text-[#C03A39] font-semibold mt-0.5 font-mono">
          {formatTime(elapsed)}
        </div>
      )}

      {/* 提示文字 */}
      {!recording && (
        <div className="text-center text-xs text-gray-500 mt-2">{modeHint}</div>
      )}
    </div>
  );
}
