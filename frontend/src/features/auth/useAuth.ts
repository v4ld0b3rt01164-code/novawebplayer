import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext.ts'

export function useAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
