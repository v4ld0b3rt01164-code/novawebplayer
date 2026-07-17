import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { XtreamAuthResponse } from '../../types/index.js'
import { AuthContext, type AuthContextValue } from './AuthContext.js'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<AuthContextValue['userInfo']>(null)

  const login = useCallback((response: XtreamAuthResponse) => {
    setToken(response.token)
    setUserInfo(response.user_info)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUserInfo(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ token, userInfo, login, logout }),
    [token, userInfo, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
