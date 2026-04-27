import { useEffect, useRef } from 'react'
import { useUserColor, useUserBio, useUserAvatar, useUserBanner } from '../contexts/AuthContext'

export default function UserProfilePopup({ user, x, y, onClose }) {
  const popupRef = useRef(null)
  const getColor = useUserColor()
  const getBio = useUserBio()
  const getAvatar = useUserAvatar()
  const getBanner = useUserBanner()
  const color = getColor(user)
  const bio = getBio(user)
  const avatarUrl = getAvatar(user)
  const bannerUrl = getBanner(user)

  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose()
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  useEffect(() => {
    if (!popupRef.current) return
    const rect = popupRef.current.getBoundingClientRect()
    const el = popupRef.current

    if (rect.right > window.innerWidth - 16) {
      el.style.left = 'auto'
      el.style.right = '16px'
    }
    if (rect.bottom > window.innerHeight - 16) {
      el.style.top = 'auto'
      el.style.bottom = '16px'
    }
  }, [])

  return (
    <div className="user-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="user-popup"
        ref={popupRef}
        style={{
          left: Math.max(16, Math.min(x, window.innerWidth - 300)),
          top: Math.max(16, Math.min(y, window.innerHeight - 400)),
        }}
      >
        <div className="user-popup-banner" style={{ background: color }}>
          {bannerUrl && <img src={bannerUrl} alt="" className="user-popup-banner-img" />}
        </div>
        <div className="user-popup-avatar" style={avatarUrl ? {} : { background: color }}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : user[0]?.toUpperCase()}
        </div>
        <div className="user-popup-body">
          <h4 className="user-popup-name">{user}</h4>
          <span className="user-popup-tag">@{user.toLowerCase().replace(/\s/g, '-')}</span>
          <div className="user-popup-section">
            <span className="user-popup-label">ABOUT ME</span>
            <p className="user-popup-about">{bio || 'No bio set.'}</p>
          </div>
          <div className="user-popup-section">
            <span className="user-popup-label">ROLES</span>
            <div className="user-popup-roles">
              <span className="user-popup-role" style={{ color: color }}>
                ● Member
              </span>
            </div>
          </div>
          <div className="user-popup-note">
            <span className="user-popup-label">NOTE</span>
            <input
              type="text"
              placeholder="Click to add a note"
              defaultValue={localStorage.getItem(`note:${user}`) || ''}
              onChange={(e) => localStorage.setItem(`note:${user}`, e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
