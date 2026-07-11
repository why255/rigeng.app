/**
 * 日耕 认证 API 模块。
 *
 * 提供登录、注册、登出及 token 管理功能。
 * 与 shared/src/api/api.ts 共享 token 存储 key（rg_token / rg_user）。
 */

import { apiPost } from './api';

// ── Types ──

export interface AuthUser {
  id: string;
  phone: string;
  nickname: string;
  avatar?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
}

// ── Token 管理 ──

const TOKEN_KEY = 'rg_token';
const USER_KEY = 'rg_user';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage 不可用时静默失败
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // 静默失败
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ── API 函数 ──

/** 登录 */
export async function login(phone: string, password: string): Promise<LoginResponse> {
  const data = await apiPost<LoginResponse & { role?: string }>('/auth/login', { phone, password });
  // 后端返回 role 在顶层，合并到 user 对象中以便前端读取
  const userWithRole = { ...data.user, role: (data as any).role || 'student' }
  setAuth(data.token, userWithRole);
  return data;
}

/** 验证码登录 */
export async function codeLogin(phone: string, code: string): Promise<LoginResponse> {
  const data = await apiPost<LoginResponse & { role?: string }>('/auth/login/code', { phone, code });
  const userWithRole = { ...data.user, role: (data as any).role || 'student' };
  setAuth(data.token, userWithRole);
  return data;
}

/** 发送短信验证码 */
export async function sendVerificationCode(
  phone: string,
  purpose: 'register' | 'login' = 'register',
): Promise<{ message: string; expires_in: number }> {
  return apiPost<{ message: string; expires_in: number }>('/auth/send-code', { phone, purpose });
}

/** 注册 */
export async function register(
  phone: string,
  code: string,
  password: string,
  nickname: string,
): Promise<RegisterResponse> {
  const data = await apiPost<RegisterResponse>('/auth/register', { phone, code, password, nickname });
  return data;
}

/** 登出（清除本地状态并跳转） */
export function logout(): void {
  clearAuth();
  window.location.href = '/login';
}
