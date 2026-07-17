import { createContext } from 'react'
import type { XtreamAuthResponse, XtreamUserInfo } from '../../types/index.js'

export interface AuthContextValue {
  token: string | null
  userInfo: XtreamUserInfo | null
  login: (response: XtreamAuthResponse) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
