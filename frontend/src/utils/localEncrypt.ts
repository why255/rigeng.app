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

/**
 * 获取或生成本次会话的加密密钥。
 * 密钥存储在 sessionStorage，关闭标签页后自动清除。
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  // 检查是否已有缓存（内存中）
  const cached = (window as any).__rigeng_mh_crypto_key;
  if (cached) return cached;

  // 尝试从 sessionStorage 恢复
  const stored = sessionStorage.getItem(STORAGE_KEY_NAME);
  if (stored) {
    try {
      const raw = JSON.parse(stored);
      const key = await crypto.subtle.importKey(
        'jwk',
        raw,
        { name: ALGO, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt'],
      );
      (window as any).__rigeng_mh_crypto_key = key;
      return key;
    } catch {
      // 恢复失败，重新生成
    }
  }

  // 生成新密钥
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true, // extractable for sessionStorage persistence
    ['encrypt', 'decrypt'],
  );

  // 导出并存入 sessionStorage
  const exported = await crypto.subtle.exportKey('jwk', key);
  sessionStorage.setItem(STORAGE_KEY_NAME, JSON.stringify(exported));

  // 缓存到内存
  (window as any).__rigeng_mh_crypto_key = key;

  return key;
}

/**
 * 加密文本，返回 Base64 编码的密文 + IV。
 */
export async function encryptLocal(plaintext: string): Promise<{
  ciphertext: string;
  iv: string;
}> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded,
  );

  // 将 ArrayBuffer 转为 Base64
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivB64 = btoa(String.fromCharCode(...iv));

  return { ciphertext, iv: ivB64 };
}

/**
 * 解密 Base64 密文，返回明文。
 */
export async function decryptLocal(
  ciphertext: string,
  iv: string,
): Promise<string> {
  const key = await getOrCreateKey();
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ctBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv: ivBytes },
    key,
    ctBytes,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * 将聊天消息数组加密后存入 localStorage。
 * 每个用户的对话独立存储，键名：rigeng_mh_msgs_{userId}
 */
export async function persistEncryptedMessages(
  userId: string,
  messages: Array<{ role: 'assistant' | 'user'; text: string; time?: string }>,
): Promise<void> {
  try {
    const json = JSON.stringify(messages);
    const { ciphertext, iv } = await encryptLocal(json);
    const payload = JSON.stringify({ ct: ciphertext, iv, v: 1 });
    localStorage.setItem(`rigeng_mh_msgs_${userId}`, payload);
  } catch (err) {
    console.warn('[localEncrypt] 加密存储失败，明文不落盘:', err);
  }
}

/**
 * 从 localStorage 读取并解密聊天消息。
 */
export async function loadEncryptedMessages(
  userId: string,
): Promise<Array<{ role: 'assistant' | 'user'; text: string; time?: string }> | null> {
  try {
    const stored = localStorage.getItem(`rigeng_mh_msgs_${userId}`);
    if (!stored) return null;

    const { ct, iv } = JSON.parse(stored);
    const json = await decryptLocal(ct, iv);
    return JSON.parse(json);
  } catch (err) {
    console.warn('[localEncrypt] 解密失败，密钥可能已变更:', err);
    // 密钥失效时清除旧数据
    localStorage.removeItem(`rigeng_mh_msgs_${userId}`);
    return null;
  }
}

/**
 * 清除用户在本地的加密倾诉数据。
 */
export function clearEncryptedMessages(userId: string): void {
  localStorage.removeItem(`rigeng_mh_msgs_${userId}`);
}

/**
 * 检查浏览器是否支持 Web Crypto API（所有现代浏览器均支持）。
 */
export function isCryptoAvailable(): boolean {
  return !!(window.crypto && window.crypto.subtle);
}
