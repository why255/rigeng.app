/**
 * 端侧本地加密工具（步骤14·情绪树洞·隐私保护）。
 *
 * 使用 Web Crypto API (AES-GCM) 对情绪树洞的倾诉内容进行本地加密。
 * 加密密钥从浏览器端生成并存储在 sessionStorage，会话结束自动清除。
 *
 * 原则：
 * - 情绪内容在离开浏览器前即加密
 * - 云端不存储明文倾诉内容
 * - 密钥仅存在于当前浏览器会话
 */

const STORAGE_KEY_NAME = 'rigeng_mh_key';
const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;

async function getOrCreateKey(): Promise<CryptoKey> {
  const cached = (window as any).__rigeng_mh_crypto_key;
  if (cached) return cached;

  const stored = sessionStorage.getItem(STORAGE_KEY_NAME);
  if (stored) {
    try {
      const raw = JSON.parse(stored);
      const key = await crypto.subtle.importKey(
        'jwk', raw, { name: ALGO, length: KEY_LENGTH },
        false, ['encrypt', 'decrypt'],
      );
      (window as any).__rigeng_mh_crypto_key = key;
      return key;
    } catch { /* 恢复失败，重新生成 */ }
  }

  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true, ['encrypt', 'decrypt'],
  );
  const exported = await crypto.subtle.exportKey('jwk', key);
  sessionStorage.setItem(STORAGE_KEY_NAME, JSON.stringify(exported));
  (window as any).__rigeng_mh_crypto_key = key;
  return key;
}

export async function encryptLocal(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivB64 = btoa(String.fromCharCode(...iv));
  return { ciphertext, iv: ivB64 };
}

export async function decryptLocal(ciphertext: string, iv: string): Promise<string> {
  const key = await getOrCreateKey();
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ctBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv: ivBytes }, key, ctBytes);
  return new TextDecoder().decode(decrypted);
}

export async function persistEncryptedMessages(
  userId: string,
  messages: Array<{ role: string; text: string; time?: string }>,
): Promise<void> {
  try {
    const json = JSON.stringify(messages);
    const { ciphertext, iv } = await encryptLocal(json);
    localStorage.setItem(`rigeng_mh_msgs_${userId}`, JSON.stringify({ ct: ciphertext, iv, v: 1 }));
  } catch (err) {
    console.warn('[localEncrypt] 加密存储失败:', err);
  }
}

export async function loadEncryptedMessages(
  userId: string,
): Promise<Array<{ role: string; text: string; time?: string }> | null> {
  try {
    const stored = localStorage.getItem(`rigeng_mh_msgs_${userId}`);
    if (!stored) return null;
    const { ct, iv } = JSON.parse(stored);
    const json = await decryptLocal(ct, iv);
    return JSON.parse(json);
  } catch {
    localStorage.removeItem(`rigeng_mh_msgs_${userId}`);
    return null;
  }
}

export function clearEncryptedMessages(userId: string): void {
  localStorage.removeItem(`rigeng_mh_msgs_${userId}`);
}

export function isCryptoAvailable(): boolean {
  return !!(window.crypto && window.crypto.subtle);
}
