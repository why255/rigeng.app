/**
 * 语音识别 API — 腾讯云 ASR。
 *
 * 后端路由: POST /voice/asr (voice_engine.router)
 * 所有模块的语音输入统一通过此 API 进行转写。
 *
 * 链路: webm Blob → AudioContext 解码 → 16kHz 单声道 WAV → Base64 → POST /voice/asr → 腾讯云
 */
import { apiPost } from './api'

/** 语音识别请求 */
export interface AsrRequest {
  audio_base64: string
  audio_format?: string   // "wav" 或 "webm"
  sample_rate?: number     // 默认 16000
  engine?: string          // 覆盖默认引擎
}

/** 语音识别响应 */
export interface AsrResponse {
  text: string
  confidence: number       // 0.0 ~ 1.0
  engine_used: string      // "tencent_online" / "vosk_offline"
  duration_ms: number
}

/* ── 内部工具：webm → WAV 转码 ── */

function encodeWav(audioBuffer: AudioBuffer, targetSampleRate: number = 16000): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const sampleRate = targetSampleRate
  const channelData = audioBuffer.getChannelData(0)

  // 简易重采样（均值降采样）
  const ratio = audioBuffer.sampleRate / targetSampleRate
  const resampledLen = Math.floor(channelData.length / ratio)
  const samples = new Float32Array(resampledLen)
  for (let i = 0; i < resampledLen; i++) {
    const srcIdx = Math.floor(i * ratio)
    let sum = 0; let count = 0
    const end = Math.min(Math.floor((i + 1) * ratio), channelData.length)
    for (let j = srcIdx; j < end; j++) { sum += channelData[j]; count++ }
    samples[i] = count > 0 ? sum / count : channelData[srcIdx]
  }

  const dataLen = samples.length * (bitsPerSample / 8)
  const headerLen = 44
  const totalLen = headerLen + dataLen
  const buf = new ArrayBuffer(totalLen)
  const view = new DataView(buf)

  function writeStr(o: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, totalLen - 8, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataLen, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return buf
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * 将浏览器录制的 webm Blob 转码为 WAV base64。
 * 使用 Web Audio API 解码后重采样到 16kHz 单声道 16-bit PCM。
 */
async function blobToWavBase64(blob: Blob): Promise<string> {
  const audioCtx = new AudioContext()
  try {
    const arrayBuf = await blob.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuf)
    const wavBuf = encodeWav(audioBuffer, 16000)
    return arrayBufferToBase64(wavBuf)
  } finally {
    audioCtx.close()
  }
}

/**
 * 语音转文字（腾讯云 ASR 在线识别）。
 *
 * 内部自动将 webm 音频转码为 16kHz WAV，确保腾讯云兼容性。
 *
 * @param audioBlob 浏览器 MediaRecorder 录制的 webm 音频 Blob
 * @returns 转写结果 { text, confidence, engine_used, duration_ms }
 */
export async function speechToText(audioBlob: Blob): Promise<AsrResponse> {
  const wavBase64 = await blobToWavBase64(audioBlob)

  return apiPost<AsrResponse>('/voice/asr', {
    audio_base64: wavBase64,
    audio_format: 'wav',
    sample_rate: 16000,
  })
}
