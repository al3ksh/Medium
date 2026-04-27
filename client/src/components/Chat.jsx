import { useState, useEffect, useRef } from 'react'
import { Menu, X, Paperclip, Reply, Pencil, SmilePlus } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useUserColor, useUserAvatar, useAuth } from '../contexts/AuthContext'
import { loadSettings } from '../utils'
import { renderMarkdown } from '../utils/markdown.jsx'
import { showToast } from './ToastContainer'
import { playNotifSound } from '../utils/notif'
import EmojiPicker from './EmojiPicker'
import MessageInput from './MessageInput'
import ConfirmModal from './ConfirmModal'

function hashColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 70%, 60%)`
}

export default function Chat({ channel, users, nickname, onUserClick, onUserContextMenu }) {
  const socket = useSocket()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const auth = useAuth()
  const myUserId = auth?.userId
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [imageViewer, setImageViewer] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [reactPicker, setReactPicker] = useState(null)
  const [reactPickerPos, setReactPickerPos] = useState({ x: 0, y: 0 })
  const bottomRef = useRef(null)
  const prevMsgCount = useRef(0)
  const token = localStorage.getItem('token')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/messages/${channel.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages(data)
        setLoading(false)
      })

    socket.emit('channel:join', channel.id)

    function onNewMessage(msg) {
      if (msg.channel_id === channel.id) {
        setMessages((prev) => [...prev, msg])
      }
      if (msg.nickname !== nickname && msg.content) {
        const isEveryone = msg.content.includes('@everyone') || msg.content.includes('@here')
        const isMentioned = msg.content.toLowerCase().includes(`@${nickname.toLowerCase()}`)
        if (isEveryone || isMentioned) {
          playNotifSound()
          const label = isEveryone ? (msg.content.includes('@everyone') ? '@everyone' : '@here') : `@${nickname}`
          showToast(`${msg.nickname} mentioned you (${label}) in #${channel.name}`)
        }
      }
    }

    function onDeleted(id) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    }

    socket.on('message:new', onNewMessage)
    socket.on('message:deleted', onDeleted)

    socket.on('typing:update', ({ channelId, typers }) => {
      if (channelId === channel.id) {
        setTypingUsers(typers.filter(n => n !== nickname))
      }
    })

    socket.on('message:edited', ({ id, content }) => {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content, edited: true } : m))
    })

    socket.on('reaction:update', ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m))
    })

    return () => {
      socket.off('message:new', onNewMessage)
      socket.off('message:deleted', onDeleted)
      socket.off('typing:update')
      socket.off('message:edited')
      socket.off('reaction:update')
    }
  }, [channel.id])

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const instant = prevMsgCount.current === 0
      bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
      if (instant) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 100)
      }
    }
    prevMsgCount.current = messages.length
  }, [messages])

  function startEdit(msg) {
    if (msg.user_id && msg.user_id !== myUserId) return
    setEditingId(msg.id)
    setEditText(msg.content || '')
  }

  function submitEdit() {
    if (!editText.trim()) return
    socket.emit('message:edit', editingId, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  function toggleReaction(messageId, emoji) {
    socket.emit('reaction:toggle', messageId, emoji)
    setReactPicker(null)
  }

  function openReactPicker(e, msgId) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(rect.left, window.innerWidth - 340)
    const y = rect.bottom + 4 + 300 > window.innerHeight ? rect.top - 4 - 300 : rect.bottom + 4
    setReactPickerPos({ x, y: Math.max(y, 8) })
    setReactPicker(reactPicker === msgId ? null : msgId)
  }

  useEffect(() => {
    if (reactPicker === null) return
    function handleClick(e) {
      const picker = document.querySelector('.reaction-picker-fixed')
      const btn = e.target.closest('[data-react-btn]')
      if (btn || (picker && picker.contains(e.target))) return
      setReactPicker(null)
    }
    function handleKey(e) {
      if (e.key === 'Escape' && editingId === null) setReactPicker(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [reactPicker, editingId])

  function handleSend(content, attachmentData) {
    socket.emit('message:send', {
      channelId: channel.id,
      content,
      attachment: attachmentData?.url || null,
      attachmentName: attachmentData?.originalName || null,
      attachmentType: attachmentData?.mimetype || null,
      replyTo: replyTo?.id || null,
    })
    setReplyTo(null)
  }

  function handleDeleteMessage(id, e) {
    if (e?.shiftKey) {
      socket.emit('message:delete', id)
      return
    }
    setDeleteConfirm(id)
  }

  function confirmDelete() {
    socket.emit('message:delete', deleteConfirm)
    setDeleteConfirm(null)
  }

  function renderContent(text) {
    const mentionRegex = /(@\w[\w\s]*?)(?=\s|$|[^\w])/g
    const parts = text.split(mentionRegex)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1).trim()
        if (name === 'everyone' || name === 'here') {
          return <span key={i} className="mention mention-everyone">{part}</span>
        }
        const isReal = users.some(u => u === name)
        if (isReal) {
          return <span key={i} className="mention" style={{ color: getColor(name) }} onClick={(e) => { e.stopPropagation(); onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 }) }}>{part}</span>
        }
      }
      return <span key={i}>{renderMarkdown(part)}</span>
    })
  }

  function formatTime(ts) {
    const d = new Date(ts * 1000)
    const settings = loadSettings()
    const opts = { hour: '2-digit', minute: '2-digit' }
    if (settings.showSeconds) opts.second = '2-digit'
    return d.toLocaleTimeString([], opts)
  }

  function isImage(mimetype) {
    return mimetype && mimetype.startsWith('image/')
  }

  function isGifUrl(text) {
    if (!text) return false
    const trimmed = text.trim()
    return /^https?:\/\/media\d*\.giphy\.com\/media\/.+/i.test(trimmed) ||
      /^https?:\/\/.+\.giphy\.com\/.+/i.test(trimmed) ||
      (/^https?:\/\/.+/i.test(trimmed) && trimmed.endsWith('.gif') && !trimmed.includes(' '))
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="mobile-toggle" onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}>
          <Menu size={20} />
        </div>
        <span className="chat-channel-name"># {channel.name}</span>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">No messages yet. Say something!</div>
        ) : (
          messages.map((msg) => {
            const isImpersonated = msg.nickname === nickname && msg.user_id && msg.user_id !== myUserId
            const isOwn = msg.user_id === myUserId
            const isEditing = editingId === msg.id
            return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`message${isImpersonated ? ' message-impersonator' : ''}`}>
              <div
                className="message-avatar clickable"
                style={getAvatar(msg.nickname) ? {} : { background: isImpersonated ? hashColor(msg.user_id) : getColor(msg.nickname) }}
                onClick={(e) => onUserClick?.({ user: msg.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                     onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, msg.nickname) }}
              >
                {getAvatar(msg.nickname) ? <img src={getAvatar(msg.nickname)} alt="" /> : msg.nickname[0]?.toUpperCase()}
              </div>
              <div className="message-body">
                <div className="message-header">
                  <span
                    className="message-nick clickable"
                    style={{ color: isImpersonated ? hashColor(msg.user_id) : getColor(msg.nickname) }}
                    onClick={(e) => onUserClick?.({ user: msg.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, msg.nickname) }}
                  >
                    {msg.nickname}
                  </span>
                  <span className="message-time">{formatTime(msg.created_at)}{msg.edited ? ' (edited)' : ''}</span>
                  <div className="message-actions">
                    <button className="message-action" onClick={() => setReplyTo(msg)} title="Reply">
                      <Reply size={14} />
                    </button>
                    <button className="message-action" data-react-btn onClick={(e) => openReactPicker(e, msg.id)} title="Add Reaction">
                      <SmilePlus size={14} />
                    </button>
                    {isOwn && !isEditing && (
                      <button className="message-action" onClick={() => startEdit(msg)} title="Edit">
                        <Pencil size={14} />
                      </button>
                    )}
                    {isOwn && (
                      <button className="message-action" onClick={(e) => handleDeleteMessage(msg.id, e)} title="Delete (hold Shift to skip confirmation)">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="message-edit-container">
                    <input
                      className="message-edit-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
                        if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); setEditText('') }
                      }}
                      autoFocus
                    />
                    <span className="message-edit-hint">escape to cancel, enter to save</span>
                  </div>
                ) : (
                  <>
                    {msg.reply_to && (
                  <div className="message-reply-ref" onClick={() => {
                    const el = document.getElementById(`msg-${msg.reply_to.id}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el?.classList.add('message-highlight')
                    setTimeout(() => el?.classList.remove('message-highlight'), 1500)
                  }}>
                    <div className="reply-ref-line" />
                    <span className="reply-ref-nick" style={{ color: getColor(msg.reply_to.nickname) }}>
                      {msg.reply_to.nickname}
                    </span>
                    <span className="reply-ref-content">
                      {msg.reply_to.content ? (msg.reply_to.content.length > 80 ? msg.reply_to.content.slice(0, 80) + '...' : msg.reply_to.content) : 'Click to see attachment'}
                    </span>
                  </div>
                )}
                {msg.content && !isGifUrl(msg.content) && <div className="message-text">{renderContent(msg.content)}</div>}
                {msg.content && isGifUrl(msg.content) && (
                  <div className="message-gif-container">
                    <img src={msg.content.trim()} alt="GIF" className="message-gif" loading="lazy" onClick={() => setImageViewer(msg.content.trim())} />
                  </div>
                )}
                {msg.attachment && isImage(msg.attachment_type) && (
                  <div className="message-image-container" onClick={() => setImageViewer(msg.attachment)}>
                    <img src={msg.attachment} alt="" className="message-image" loading="lazy" />
                  </div>
                )}
                {msg.attachment && !isImage(msg.attachment_type) && (
                  <a href={msg.attachment} target="_blank" rel="noreferrer" className="message-file">
                    <Paperclip size={14} /> {msg.attachment_name || 'File'}
                  </a>
                )}
                  </>
                )}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="message-reactions">
                    {msg.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        className={`reaction-chip${r.nicknames.includes(nickname) ? ' reacted' : ''}`}
                        onClick={() => toggleReaction(msg.id, r.emoji)}
                        title={r.nicknames.join(', ')}
                      >
                        <span className="reaction-emoji">{r.emoji}</span>
                        <span className="reaction-count">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )})
        )}
        <div ref={bottomRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <span /><span /><span />
          </div>
          <div className="typing-users">
            {typingUsers.map((name) => (
              <div key={name} className="typing-user">
                <div className="typing-avatar" style={getAvatar(name) ? {} : { background: getColor(name) }}>
                  {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
                </div>
                <span>{name}</span>
              </div>
            ))}
          </div>
          <span className="typing-text">
            {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      <MessageInput onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} users={users} nickname={nickname} channelId={channel.id} socket={socket} />

      {reactPicker !== null && (
        <div className="reaction-picker-fixed" style={{ left: reactPickerPos.x, top: reactPickerPos.y }}>
          <EmojiPicker onSelect={(emoji) => toggleReaction(reactPicker, emoji)} onClose={() => setReactPicker(null)} />
        </div>
      )}

      {imageViewer && (
        <div className="image-viewer-overlay" onClick={() => setImageViewer(null)}>
          <button className="image-viewer-close" onClick={() => setImageViewer(null)}>
            <X size={24} />
          </button>
          <img src={imageViewer} className="image-viewer-img" alt="" onClick={(e) => e.stopPropagation()} />
          <a href={imageViewer} target="_blank" rel="noreferrer" className="image-viewer-open" onClick={(e) => e.stopPropagation()}>
            Open original
          </a>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Message"
          message="Are you sure you want to delete this message?"
          confirmLabel="Delete"
          danger
          tip="Hold Shift + Click to skip this confirmation"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
