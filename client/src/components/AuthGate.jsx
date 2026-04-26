import { useState } from 'react'

export default function AuthGate({ onLogin }) {
  const [step, setStep] = useState('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePassphrase(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, nickname: 'check' }),
      })
      if (res.ok) {
        setStep('nickname')
      } else {
        const data = await res.json()
        setError(data.error || 'Wrong passphrase')
      }
    } catch {
      setError('Connection error')
    }
    setLoading(false)
  }

  async function handleNickname(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, nickname }),
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.token, data.nickname)
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch {
      setError('Connection error')
    }
    setLoading(false)
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1 className="auth-logo">Medium</h1>
        {step === 'passphrase' ? (
          <form onSubmit={handlePassphrase}>
            <p className="auth-subtitle">Enter the passphrase to join</p>
            <input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <button type="submit" disabled={loading || !passphrase}>
              {loading ? '...' : 'Continue'}
            </button>
            {error && <p className="auth-error">{error}</p>}
          </form>
        ) : (
          <form onSubmit={handleNickname}>
            <p className="auth-subtitle">Pick your nickname</p>
            <input
              type="text"
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
              maxLength={20}
              disabled={loading}
            />
            <button type="submit" disabled={loading || nickname.length < 2}>
              {loading ? '...' : 'Join'}
            </button>
            {error && <p className="auth-error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
