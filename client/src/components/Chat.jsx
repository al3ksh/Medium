import { useState, useEffect, useRef } from 'react'
import { Menu, X, Paperclip, Reply } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useUserColor, useUserAvatar } from '../contexts/AuthContext'
import { loadSettings } from '../utils'
import MessageInput from './MessageInput'
import ConfirmModal from './ConfirmModal'

export default function Chat({ channel, users, nickname, onUserClick, onUserContextMenu }) {
  const socket = useSocket()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [imageViewer, setImageViewer] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
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
    }

    function onDeleted(id) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    }

    socket.on('message:new', onNewMessage)
    socket.on('message:deleted', onDeleted)

    return () => {
      socket.off('message:new', onNewMessage)
      socket.off('message:deleted', onDeleted)
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
    const parts = text.split(/(@\w[\w\s]*?)(?=\s|$|[^\w])/g)
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
      return part
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
          messages.map((msg) => (
            <div key={msg.id} id={`msg-${msg.id}`} className="message" onContextMenu={(e) => { e.preventDefault(); setReplyTo(msg) }}>
              <div
                className="message-avatar clickable"
                style={getAvatar(msg.nickname) ? {} : { background: getColor(msg.nickname) }}
                onClick={(e) => onUserClick?.({ user: msg.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                     onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, msg.nickname) }}
              >
                {getAvatar(msg.nickname) ? <img src={getAvatar(msg.nickname)} alt="" /> : msg.nickname[0]?.toUpperCase()}
              </div>
              <div className="message-body">
                <div className="message-header">
                  <span
                    className="message-nick clickable"
                    style={{ color: getColor(msg.nickname) }}
                    onClick={(e) => onUserClick?.({ user: msg.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, msg.nickname) }}
                  >
                    {msg.nickname}
                  </span>
                  <span className="message-time">{formatTime(msg.created_at)}</span>
                  <div className="message-actions">
                    <button className="message-action" onClick={() => setReplyTo(msg)} title="Reply">
                      <Reply size={14} />
                    </button>
                    <button className="message-action" onClick={(e) => handleDeleteMessage(msg.id, e)} title="Delete (hold Shift to skip confirmation)">
                      <X size={14} />
                    </button>
                  </div>
                </div>
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
                {msg.content && !isGifUrl(msg.content) && <p className="message-text">{renderContent(msg.content)}</p>}
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
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} users={users} nickname={nickname} />

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
