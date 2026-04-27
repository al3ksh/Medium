import { useEffect, useRef, useState } from 'react'
import { Hash, Volume2, Pencil, Plus, Trash2, Bell, BellOff, BellRing } from 'lucide-react'

const MUTE_KEY = 'medium-channel-mutes'
const NOTIF_KEY = 'medium-channel-notifs'

function getMutes() {
  try { return JSON.parse(localStorage.getItem(MUTE_KEY)) || {} } catch { return {} }
}

function setMuted(channelId, until) {
  const mutes = getMutes()
  if (until) mutes[channelId] = until
  else delete mutes[channelId]
  localStorage.setItem(MUTE_KEY, JSON.stringify(mutes))
  window.dispatchEvent(new Event('channel-mutes-changed'))
}

export function isChannelMuted(channelId) {
  const mutes = getMutes()
  if (!mutes[channelId]) return false
  if (Date.now() > mutes[channelId]) {
    delete mutes[channelId]
    localStorage.setItem(MUTE_KEY, JSON.stringify(mutes))
    return false
  }
  return true
}

export function getNotifSetting(channelId) {
  try {
    const settings = JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}
    return settings[channelId] || 'default'
  } catch { return 'default' }
}

function setNotifSetting(channelId, value) {
  const settings = JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}
  if (value === 'default') delete settings[channelId]
  else settings[channelId] = value
  localStorage.setItem(NOTIF_KEY, JSON.stringify(settings))
}

export default function ChannelContextMenu({ channel, x, y, onOpen, onJoinVoice, onEdit, onCreate, onDelete, onClose }) {
  const menuRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(channel.name)
  const editRef = useRef(null)

  useEffect(() => {
    if (editing) {
      editRef.current?.focus()
      editRef.current?.select()
    }
  }, [editing])

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
  const menuY = Math.min(y, window.innerHeight - 240)

  const Icon = channel.type === 'text' ? Hash : Volume2

  function handleEditSubmit(e) {
    e.preventDefault()
    if (!editName.trim() || editName.trim() === channel.name) {
      setEditing(false)
      return
    }
    onEdit(channel.id, editName.trim())
    setEditing(false)
    onClose()
  }

  function handleOpen() {
    if (channel.type === 'voice') {
      onJoinVoice(channel)
    }
    onOpen(channel)
    onClose()
  }

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div className="context-menu" ref={menuRef} style={{ left: menuX, top: menuY }} onClick={(e) => e.stopPropagation()}>
        <button className="context-item" onClick={handleOpen}>
          <Icon size={14} /> {channel.type === 'text' ? 'Open Channel' : 'Join Channel'}
        </button>
        <div className="context-sep" />
        {editing ? (
          <form className="context-edit-form" onSubmit={handleEditSubmit}>
            <input
              ref={editRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleEditSubmit}
              maxLength={30}
            />
          </form>
        ) : (
          <button className={`context-item${channel.locked ? ' disabled' : ''}`} onClick={channel.locked ? undefined : () => setEditing(true)}>
            <Pencil size={14} /> Edit Channel
          </button>
        )}
        <button className={`context-item${channel.locked ? ' disabled' : ''}`} onClick={channel.locked ? undefined : () => { onCreate(); onClose() }}>
          <Plus size={14} /> Create Channel
        </button>
        <div className="context-sep" />
        {channel.type === 'text' && (
          <>
            <div className="context-item context-submenu-trigger">
              <BellOff size={14} /> Mute Channel
              <span className="context-arrow">▸</span>
              <div className="context-submenu">
                <button className="context-item" onClick={() => { setMuted(channel.id, Date.now() + 15 * 60 * 1000); onClose() }}>
                  15 minutes
                </button>
                <button className="context-item" onClick={() => { setMuted(channel.id, Date.now() + 30 * 60 * 1000); onClose() }}>
                  30 minutes
                </button>
                <button className="context-item" onClick={() => { setMuted(channel.id, Date.now() + 60 * 60 * 1000); onClose() }}>
                  1 hour
                </button>
                {isChannelMuted(channel.id) && (
                  <>
                    <div className="context-sep" />
                    <button className="context-item" onClick={() => { setMuted(channel.id, null); onClose() }}>
                      Unmute
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="context-item context-submenu-trigger">
              <Bell size={14} /> Notification Settings
              <span className="context-arrow">▸</span>
              <div className="context-submenu">
                <button className={`context-item${getNotifSetting(channel.id) === 'default' ? ' active' : ''}`} onClick={() => { setNotifSetting(channel.id, 'default'); onClose() }}>
                  <Bell size={14} /> All Messages
                </button>
                <button className={`context-item${getNotifSetting(channel.id) === 'mentions' ? ' active' : ''}`} onClick={() => { setNotifSetting(channel.id, 'mentions'); onClose() }}>
                  <BellRing size={14} /> Mentions Only
                </button>
                <button className={`context-item${getNotifSetting(channel.id) === 'none' ? ' active' : ''}`} onClick={() => { setNotifSetting(channel.id, 'none'); onClose() }}>
                  <BellOff size={14} /> None
                </button>
              </div>
            </div>
            <div className="context-sep" />
          </>
        )}
        <button className={`context-item danger${channel.locked ? ' disabled' : ''}`} onClick={channel.locked ? undefined : () => { onDelete(channel); onClose() }}>
          <Trash2 size={14} /> Delete Channel
        </button>
      </div>
    </div>
  )
}
