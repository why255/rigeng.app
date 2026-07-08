/**
 * 日耕统一 API 客户端。
 *
 * 封装 fetch：自动注入认证头、统一解包响应信封 { code, data, message, trace_id }、
 * 错误抛出标准 ApiError。
 */

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  code: number;
  httpStatus: number;
  traceId?: string;

  constructor(code: number, message: string, httpStatus: number = 400, traceId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.traceId = traceId;
  }
}

export class NetworkError extends Error {
  constructor(message: string = '网络连接失败，请检查网络') {
    super(message);
    this.name = 'NetworkError';
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem('rg_token');
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      // 401 未认证 → 清除 token 并跳转登录
      if (res.status === 401) {
        try {
          localStorage.removeItem('rg_token');
          localStorage.removeItem('rg_user');
        } catch {
          // 静默失败
        }
        window.location.href = '/login';
        throw new ApiError(401, '未登录，请先登录', 401);
      }

      // 尝试解析业务错误
      let errData: { code?: number; message?: string; trace_id?: string } = {};
      try {
        errData = await res.json();
      } catch {
        // 非 JSON 响应
      }
      throw new ApiError(
        errData.code ?? res.status,
        errData.message ?? `请求失败 (${res.status})`,
        res.status,
        errData.trace_id,
      );
    }

    const json = await res.json();
    if (json.code !== 0) {
      throw new ApiError(json.code, json.message, 400, json.trace_id);
    }
    return json.data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (!navigator.onLine) {
      throw new NetworkError('当前离线，无法连接服务器');
    }
    throw new NetworkError(e instanceof Error ? e.message : '网络请求失败');
  }
}

export function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  return request<T>('GET', path, undefined, params);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
