import { createContext, useContext, useState } from 'react'
import { nicknameToColor, loadSettings } from '../utils'

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export function useAvatarColor() {
  const auth = useContext(AuthContext)
  return auth?.avatarColor || nicknameToColor(auth?.nickname || '')
}

export function useUserColor() {
  const auth = useContext(AuthContext)
  return (name) => {
    if (auth?.userColors?.[name]) return auth.userColors[name]
    if (name === auth?.nickname && auth?.avatarColor) return auth.avatarColor
    return nicknameToColor(name)
  }
}
