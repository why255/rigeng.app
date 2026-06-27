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
  const data = await apiPost<LoginResponse>('/auth/login', { phone, password });
  setAuth(data.token, data.user);
  return data;
}

/** 注册 */
export async function register(
  phone: string,
  password: string,
  nickname: string,
): Promise<RegisterResponse> {
  const data = await apiPost<RegisterResponse>('/auth/register', { phone, password, nickname });
  return data;
}

/** 登出（清除本地状态并跳转） */
export function logout(): void {
  clearAuth();
  window.location.href = '/login';
}
