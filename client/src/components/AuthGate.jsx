import { useState, useRef, useEffect } from 'react'
import LegalModal from './LegalModal'

function MagneticButton({ children, disabled, ...props }) {
  const buttonRef = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e) => {
    if (disabled || !buttonRef.current) return
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect()
    const x = e.clientX - (left + width / 2)
    const y = e.clientY - (top + height / 2)
    setPosition({ x: x * 0.08, y: y * 0.12 })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: disabled ? 'none' : `translate(${position.x}px, ${position.y}px)`,
        transition: position.x === 0 && position.y === 0 
          ? 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)' 
          : 'transform 0.15s ease-out, box-shadow 0.2s',
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

export default function AuthGate({ onLogin }) {
  const [step, setStep] = useState('nickname')
  const [passphrase, setPassphrase] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ripples, setRipples] = useState([])
  const [cookieConsent, setCookieConsent] = useState(true)
  const [legalType, setLegalType] = useState(null)
  const [needsPassphrase, setNeedsPassphrase] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('medium-cookie-consent')) {
      setCookieConsent(false)
    }
    fetch('/api/auth/config').then(r => r.json()).then(cfg => {
      if (cfg.passphraseEnabled) {
        setNeedsPassphrase(true)
        setStep('passphrase')
      }
    }).catch(() => {})
  }, [])

  function handleAcceptCookies() {
    localStorage.setItem('medium-cookie-consent', 'true')
    setCookieConsent(true)
  }

  function handleLeftClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const newRipple = { id: Date.now(), x, y }
    setRipples((prev) => [...prev, newRipple])
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
    }, 1000)
  }

  async function handlePassphrase(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/check-passphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
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
      const body = { nickname }
      if (needsPassphrase) body.passphrase = passphrase
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.token, data.nickname, data.userId)
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch {
      setError('Connection error')
    }
    setLoading(false)
  }

  return (
    <div className="auth-gate premium-split">
      <div className="auth-split-left" onClick={handleLeftClick}>
        <div className="liquid-aurora"></div>
        <img 
          src="/mediu color upscale.webp" 
          alt="Medium Logo" 
          className="auth-premium-logo" 
          fetchPriority="high" 
          loading="eager" 
        />
        {ripples.map((r) => (
          <div key={r.id} className="ripple-effect" style={{ left: r.x, top: r.y }} />
        ))}
      </div>
      
      <div className="auth-split-right">
        <div className="auth-premium-card">
          {needsPassphrase && step === 'passphrase' ? (
            <form onSubmit={handlePassphrase}>
              <h2>Welcome back</h2>
              <p className="auth-subtitle">Enter the passphrase to join</p>
              <input
                type="password"
                placeholder="Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                disabled={loading}
              />
              <MagneticButton type="submit" disabled={loading || !passphrase}>
                {loading ? '...' : 'Continue'}
              </MagneticButton>
              {error && <p className="auth-error">{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleNickname}>
              <h2>Welcome to Medium</h2>
              <p className="auth-subtitle">Make contact</p>
              <input
                type="text"
                placeholder="Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoFocus
                maxLength={20}
                disabled={loading}
              />
              <MagneticButton type="submit" disabled={loading || nickname.length < 2}>
                {loading ? '...' : 'Join'}
              </MagneticButton>
              {error && <p className="auth-error">{error}</p>}
            </form>
          )}
        </div>
      </div>

      {!cookieConsent && (
        <div className="cookie-banner">
          <div className="cookie-banner-content">
            <p>
              Medium uses local storage to save your session and preferences. By using Medium, you agree to our{' '}
              <span className="legal-link" onClick={() => setLegalType('privacy')}>Privacy Policy</span> and{' '}
              <span className="legal-link" onClick={() => setLegalType('terms')}>Terms of Use</span>.
            </p>
            <button className="cookie-accept-btn" onClick={handleAcceptCookies}>Accept</button>
          </div>
        </div>
      )}

      {legalType && (
        <LegalModal type={legalType} onClose={() => setLegalType(null)} />
      )}
    </div>
  )
}
