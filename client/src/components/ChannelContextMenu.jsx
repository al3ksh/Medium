import { useEffect, useRef, useState } from 'react'
import { Hash, Volume2, Pencil, Plus, Trash2 } from 'lucide-react'

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
        <button className={`context-item danger${channel.locked ? ' disabled' : ''}`} onClick={channel.locked ? undefined : () => { onDelete(channel); onClose() }}>
          <Trash2 size={14} /> Delete Channel
        </button>
      </div>
    </div>
  )
}
