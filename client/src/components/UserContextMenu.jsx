import { useEffect, useRef } from 'react'
import { User, Volume2, VolumeX } from 'lucide-react'

export default function UserContextMenu({ user, x, y, onProfile, onMuteToggle, onVolumeChange, isMuted, volume, onClose }) {
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

  const menuX = Math.min(x, window.innerWidth - 220)
  const menuY = Math.min(y, window.innerHeight - 200)

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div className="context-menu" ref={menuRef} style={{ left: menuX, top: menuY }}>
        <button className="context-item" onClick={() => { onProfile(user); onClose() }}>
            <User size={14} /> Profile
        </button>
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
      </div>
    </div>
  )
}
