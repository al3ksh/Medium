import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { AuthContext } from './contexts/AuthContext'
import { SocketContext } from './contexts/SocketContext'
import { VoiceProvider } from './contexts/VoiceContext'
import { nicknameToColor, loadSettings } from './utils'
import AuthGate from './components/AuthGate'
import MainLayout from './pages/MainLayout'

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token')
    const nickname = localStorage.getItem('nickname')
    const avatarColor = loadSettings().avatarColor || nicknameToColor(nickname || '')
    return token ? { token, nickname, ready: false, avatarColor, userColors: {}, userProfiles: {} } : null
  })
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!auth?.token) {
      setSocket(null)
      return
    }

    fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          const s = io({ auth: { token: auth.token }, transports: ['websocket'] })

          s.on('user:colors', (colors) => {
            setAuth((a) => a ? { ...a, userColors: colors } : a)
          })

          s.on('user:profiles', (profiles) => {
            setAuth((a) => a ? { ...a, userProfiles: profiles } : a)
          })

          setSocket(s)
          setAuth((a) => ({ ...a, ready: true }))
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('nickname')
          setAuth(null)
          setSocket(null)
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('nickname')
        setAuth(null)
        setSocket(null)
      })

    return () => {}
  }, [auth?.token])

  function handleLogin(token, nickname) {
    const avatarColor = loadSettings().avatarColor || nicknameToColor(nickname)
    localStorage.setItem('token', token)
    localStorage.setItem('nickname', nickname)
    setAuth({ token, nickname, ready: false, avatarColor, userColors: {}, userProfiles: {} })
  }

  function handleLogout() {
    if (socket) socket.disconnect()
    localStorage.removeItem('token')
    localStorage.removeItem('nickname')
    setAuth(null)
    setSocket(null)
  }

  function updateAvatarColor(color) {
    setAuth((a) => a ? { ...a, avatarColor: color } : a)
    if (socket) socket.emit('user:color', color)
  }

  if (!auth) {
    return <AuthGate onLogin={handleLogin} />
  }

  if (!auth.ready || !socket) {
    return <div className="loading">Connecting...</div>
  }

  const existingSocket = socket
  if (auth.avatarColor && auth.nickname) {
    setTimeout(() => existingSocket.emit('user:color', auth.avatarColor), 500)
  }

  return (
    <AuthContext.Provider value={{ ...auth, logout: handleLogout, updateAvatarColor }}>
      <SocketContext.Provider value={socket}>
        <VoiceProvider>
          <MainLayout />
        </VoiceProvider>
      </SocketContext.Provider>
    </AuthContext.Provider>
  )
}
