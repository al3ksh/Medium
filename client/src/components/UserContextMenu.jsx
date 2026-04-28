import { useEffect, useRef, useState } from 'react'
import { User, Volume2, VolumeX, PhoneOff } from 'lucide-react'

export default function UserContextMenu({ user, x, y, nickname, onProfile, onMuteToggle, onVolumeChange, isMuted, volume, voiceChannelOfUser, onKickFromVoice, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
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

  const menuW = 220
  const menuX = Math.min(x, window.innerWidth - menuW)
  const [menuY, setMenuY] = useState(y)

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      if (rect.bottom > window.innerHeight) {
        setMenuY(Math.max(0, y - rect.height))
      }
    }
  }, [])

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div className="context-menu" ref={menuRef} style={{ left: menuX, top: menuY }}>
        <button className="context-item" onClick={() => { onProfile(user); onClose() }}>
            <User size={14} /> Profile
        </button>
        {user !== nickname && (
          <>
            <div className="context-sep" />
            <div className="context-item-static">
              <label className="context-volume-label">
                User Volume
              </label>
              <div className="context-volume-row">
                <input
                  type="range" min="0" max="200" value={volume}
                  onChange={(e) => onVolumeChange(user, parseInt(e.target.value))}
                />
                <span>{volume}%</span>
              </div>
            </div>
            <div className="context-sep" />
            <button className={`context-item ${isMuted ? 'danger' : ''}`} onClick={() => { onMuteToggle(user); onClose() }}>
                {isMuted ? <><Volume2 size={14} /> Unmute User</> : <><VolumeX size={14} /> Mute User</>}
            </button>
          </>
        )}
        {voiceChannelOfUser && (
          <>
            <div className="context-sep" />
            <button className="context-item danger" onClick={() => { onKickFromVoice?.(user); onClose() }}>
              <PhoneOff size={14} /> Disconnect from Voice
            </button>
          </>
        )}
      </div>
    </div>
  )
}
