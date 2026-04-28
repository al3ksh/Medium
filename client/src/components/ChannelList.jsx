import { useState } from 'react'
import { Hash, Volume2, Plus, X, MicOff, Headphones, Lock, BellOff } from 'lucide-react'
import { useVoice } from '../contexts/VoiceContext'
import { isChannelMuted } from './ChannelContextMenu'
import { useUserColor, useUserAvatar } from '../contexts/AuthContext'

export default function ChannelList({ label, channels, activeId, onSelect, type, socket, onChannelCreated, onChannelDeleted, onChannelContextMenu, onUserClick, onUserContextMenu, onRequestCreate, unlockedChannels, onUnlockNeeded, unread }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const { occupancy, joined, voiceChannel, leaveVoice, nickname, isMuted, isDeafened, voiceStates, socketId } = useVoice()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const token = localStorage.getItem('token')

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return

    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newName.trim(), type }),
    })

    if (res.ok) {
      const channel = await res.json()
      socket.emit('channel:created', channel)
      onChannelCreated?.(channel)
    }

    setNewName('')
    setCreating(false)
  }

  function handleSelect(ch) {
    if (ch.locked && !unlockedChannels?.has(ch.id)) {
      onUnlockNeeded?.(ch)
      return
    }
    onSelect(ch)
  }

  const ChannelIcon = type === 'text' ? Hash : Volume2

  return (
    <div className="channel-section">
      <div className="channel-section-header">
        <span>{label}</span>
        <button className="channel-add-btn" onClick={() => { setCreating(!creating); onRequestCreate?.() }} title="Add channel">
          <Plus size={16} />
        </button>
      </div>

      {creating && (
        <form className="channel-create-form" onSubmit={handleCreate}>
          <input
            autoFocus
            placeholder={`${type} channel name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { if (!newName) setCreating(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
          />
        </form>
      )}

      {channels.map((ch) => {
        const users = occupancy[ch.id] || []
        const isJoinedVoice = joined && voiceChannel?.id === ch.id
        const allUsers = isJoinedVoice ? [...users.filter(u => u !== nickname), nickname] : users
        const isLocked = ch.locked && !unlockedChannels?.has(ch.id)

        return (
          <div key={ch.id}>
            <div
              className={`channel-item ${activeId === ch.id ? 'active' : ''}${isLocked ? ' channel-locked' : ''}`}
              onClick={() => handleSelect(ch)}
              onContextMenu={(e) => { e.preventDefault(); onChannelContextMenu?.(e, ch) }}
            >
              <span className="channel-icon">
                {isLocked ? <Lock size={16} /> : <ChannelIcon size={16} />}
              </span>
              <span className="channel-name">{ch.name}</span>
              {type === 'text' && isChannelMuted(ch.id) && (
                <BellOff size={12} className="channel-muted-icon" />
              )}
              {type === 'text' && unread?.[ch.id] > 0 && activeId !== ch.id && (
                <span className="channel-unread-badge">{unread[ch.id]}</span>
              )}
              {type === 'voice' && isJoinedVoice && !isLocked && (
                <button
                  className="voice-disconnect-inline"
                  onClick={(e) => { e.stopPropagation(); leaveVoice() }}
                  title="Disconnect"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {allUsers.length > 0 && !isLocked && (
              <div className="voice-users-list">
                {allUsers.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    className="voice-user-item clickable"
                    onClick={(e) => onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 })}
                    onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, name) }}
                  >
                    <div className="voice-user-avatar" style={getAvatar(name) ? {} : { background: getColor(name) }}>
                      {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
                    </div>
                    <span className="voice-user-name">{name}{name === nickname ? ' (you)' : ''}</span>
                    <div className="voice-user-status-icons">
                      {(() => {
                        const st = name === nickname ? { muted: isMuted, deafened: isDeafened } : voiceStates[name]
                        return <>
                          {st?.muted && !st?.deafened && <MicOff size={14} className="voice-user-status muted" />}
                          {st?.deafened && <Headphones size={14} className="voice-user-status deafened" />}
                        </>
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
