import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { AuthContext } from './contexts/AuthContext'
import { SocketContext } from './contexts/SocketContext'
import AuthGate from './components/AuthGate'
import MainLayout from './pages/MainLayout'

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token')
    const nickname = localStorage.getItem('nickname')
    return token ? { token, nickname, ready: false } : null
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
    localStorage.setItem('token', token)
    localStorage.setItem('nickname', nickname)
    setAuth({ token, nickname, ready: false })
  }

  function handleLogout() {
    if (socket) socket.disconnect()
    localStorage.removeItem('token')
    localStorage.removeItem('nickname')
    setAuth(null)
    setSocket(null)
  }

  if (!auth) {
    return <AuthGate onLogin={handleLogin} />
  }

  if (!auth.ready || !socket) {
    return <div className="loading">Connecting...</div>
  }

  return (
    <AuthContext.Provider value={{ ...auth, logout: handleLogout }}>
      <SocketContext.Provider value={socket}>
        <MainLayout />
      </SocketContext.Provider>
    </AuthContext.Provider>
  )
}
