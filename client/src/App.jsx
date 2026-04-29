import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { AuthContext } from './contexts/AuthContext'
import { SocketContext } from './contexts/SocketContext'
import { VoiceProvider } from './contexts/VoiceContext'
import { nicknameToColor, loadSettings } from './utils'
import AuthGate from './components/AuthGate'
import MainLayout from './pages/MainLayout'
import ToastContainer from './components/ToastContainer'

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token')
    const nickname = localStorage.getItem('nickname')
    const userId = localStorage.getItem('userId')
    const avatarColor = loadSettings().avatarColor || nicknameToColor(nickname || '')
    return token ? { token, nickname, userId, ready: false, avatarColor, userColors: {}, userProfiles: {} } : null
  })
  const [socket, setSocket] = useState(null)

  function handleLogout() {
    if (socket) socket.disconnect()
    localStorage.removeItem('token')
    localStorage.removeItem('nickname')
    localStorage.removeItem('userId')
    setAuth(null)
    setSocket(null)
  }

  useEffect(() => {
    if (!auth?.token) {
      if (socket) { socket.disconnect(); setSocket(null) }
      return
    }

    let disposed = false

    fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (disposed) return
        if (data.valid) {
          const s = io({ auth: { token: auth.token }, transports: ['websocket'] })

          s.on('connect_error', (err) => {
            if (err.message === 'Nickname in use') {
              s.disconnect()
              localStorage.removeItem('token')
              localStorage.removeItem('nickname')
              localStorage.removeItem('userId')
              setAuth({ nickInUse: true })
              setSocket(null)
            } else {
              handleLogout()
            }
          })

          s.on('user:colors', (colors) => {
            setAuth((a) => a ? { ...a, userColors: colors } : a)
          })

          s.on('user:profiles', (profiles) => {
            setAuth((a) => a ? { ...a, userProfiles: profiles } : a)
          })

          s.on('user:ids', (ids) => {
            setAuth((a) => a ? { ...a, nickUserIds: ids } : a)
          })

          setSocket(s)
          setAuth((a) => ({ ...a, ready: true }))
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('nickname')
          setAuth(null)
        }
      })
      .catch(() => {
        if (disposed) return
        localStorage.removeItem('token')
        localStorage.removeItem('nickname')
        setAuth(null)
      })

    return () => { disposed = true }
  }, [auth?.token])

  useEffect(() => {
    if (socket && auth?.avatarColor && auth?.nickname) {
      const t = setTimeout(() => socket.emit('user:color', auth.avatarColor), 500)
      return () => clearTimeout(t)
    }
  }, [socket, auth?.avatarColor, auth?.nickname])

  function handleLogin(token, nickname, userId) {
    const avatarColor = loadSettings().avatarColor || nicknameToColor(nickname)
    localStorage.setItem('token', token)
    localStorage.setItem('nickname', nickname)
    localStorage.setItem('userId', userId)
    setAuth({ token, nickname, userId, ready: false, avatarColor, userColors: {}, userProfiles: {} })
  }

  function updateAvatarColor(color) {
    setAuth((a) => a ? { ...a, avatarColor: color } : a)
    if (socket) socket.emit('user:color', color)
  }

  if (!auth || auth.nickInUse) {
    return <AuthGate onLogin={handleLogin} initialError={auth?.nickInUse ? 'This nickname is still in use. Wait a moment and try again.' : undefined} />
  }

  if (!auth.ready || !socket) {
    return <div className="loading">Connecting...</div>
  }

  return (
    <AuthContext.Provider value={{ ...auth, logout: handleLogout, updateAvatarColor }}>
      <SocketContext.Provider value={socket}>
        <VoiceProvider>
          <MainLayout />
          <ToastContainer />
        </VoiceProvider>
      </SocketContext.Provider>
    </AuthContext.Provider>
  )
}
