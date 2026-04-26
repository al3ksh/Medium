import { useState } from 'react'
import { useVoice } from '../contexts/VoiceContext'
import { useUserColor } from '../contexts/AuthContext'

export default function ChannelList({ label, channels, activeId, onSelect, type, socket, onChannelCreated, onChannelDeleted, onUserClick, onUserContextMenu }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const { occupancy, joined, voiceChannel, leaveVoice, nickname } = useVoice()
  const getColor = useUserColor()
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

  async function handleDelete(channelId, e) {
    e.stopPropagation()
    if (!confirm('Delete this channel?')) return

    const res = await fetch(`/api/channels/${channelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok) {
      socket.emit('channel:deleted', channelId)
      onChannelDeleted?.(channelId)
    }
  }

  const icon = type === 'text' ? '#' : '🔊'

  return (
    <div className="channel-section">
      <div className="channel-section-header">
        <span>{label}</span>
        <button className="channel-add-btn" onClick={() => setCreating(!creating)} title="Add channel">
          +
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
          />
        </form>
      )}

      {channels.map((ch) => {
        const users = occupancy[ch.id] || []
        const isJoinedVoice = joined && voiceChannel?.id === ch.id
        const allUsers = isJoinedVoice ? [...users.filter(u => u !== nickname), nickname] : users

        return (
          <div key={ch.id}>
            <div
              className={`channel-item ${activeId === ch.id ? 'active' : ''}`}
              onClick={() => onSelect(ch)}
            >
              <span className="channel-icon">{icon}</span>
              <span className="channel-name">{ch.name}</span>
              {type === 'voice' && isJoinedVoice && (
                <button
                  className="voice-disconnect-inline"
                  onClick={(e) => { e.stopPropagation(); leaveVoice() }}
                  title="Disconnect"
                >
                  ✕
                </button>
              )}
              <button className="channel-delete-btn" onClick={(e) => handleDelete(ch.id, e)} title="Delete">
                ×
              </button>
            </div>
            {allUsers.length > 0 && (
              <div className="voice-users-list">
                {allUsers.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    className="voice-user-item clickable"
                    onClick={(e) => onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 })}
                    onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, name) }}
                  >
                    <div className="voice-user-avatar" style={{ background: getColor(name) }}>{name[0]?.toUpperCase()}</div>
                    <span>{name}{name === nickname ? ' (you)' : ''}</span>
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
