import { useState } from 'react'

export default function ChannelList({ label, channels, activeId, onSelect, type, socket, onChannelCreated, onChannelDeleted }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
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

      {channels.map((ch) => (
        <div
          key={ch.id}
          className={`channel-item ${activeId === ch.id ? 'active' : ''}`}
          onClick={() => onSelect(ch)}
        >
          <span className="channel-icon">{icon}</span>
          <span className="channel-name">{ch.name}</span>
          <button className="channel-delete-btn" onClick={(e) => handleDelete(ch.id, e)} title="Delete">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
