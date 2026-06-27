/**
 * useAuth — 认证状态 Hook。
 *
 * 检查 localStorage 中的 token 并通过 /api/v1/users/me 验证有效性。
 * 用于 ProtectedRoute 路由守卫和全局认证状态判定。
 */
import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/api/api'

export interface AuthUser {
  user_id: string
  nickname?: string
  care_mode: string
  voice_type?: string
}

export interface UseAuthReturn {
  /** 是否已完成认证检查 */
  isChecking: boolean
  /** 是否已认证（token 有效） */
  isAuthenticated: boolean
  /** 当前用户信息（认证通过后才有值） */
  user: AuthUser | null
  /** 手动重新验证 */
  recheck: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  const check = useCallback(async () => {
    const token = localStorage.getItem('rg_token')
    if (!token) {
      setIsAuthenticated(false)
      setUser(null)
      setIsChecking(false)
      return
    }

    try {
      const userData = await apiGet<AuthUser>('/users/me')
      setIsAuthenticated(true)
      setUser(userData)
    } catch {
      // token 无效或网络错误
      setIsAuthenticated(false)
      setUser(null)
      // 清除无效 token
      try {
        localStorage.removeItem('rg_token')
        localStorage.removeItem('rg_user')
      } catch {
        // 静默失败
      }
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return { isChecking, isAuthenticated, user, recheck: check }
}
