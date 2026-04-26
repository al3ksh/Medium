import { useState, useEffect, useRef } from 'react'
import { Menu, X, Paperclip } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useUserColor } from '../contexts/AuthContext'
import { loadSettings } from '../utils'
import MessageInput from './MessageInput'

export default function Chat({ channel, onUserClick, onUserContextMenu }) {
  const socket = useSocket()
  const getColor = useUserColor()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [imageViewer, setImageViewer] = useState(null)
  const bottomRef = useRef(null)
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(content, attachmentData) {
    socket.emit('message:send', {
      channelId: channel.id,
      content,
      attachment: attachmentData?.url || null,
      attachmentName: attachmentData?.originalName || null,
      attachmentType: attachmentData?.mimetype || null,
    })
  }

  function handleDeleteMessage(id) {
    socket.emit('message:delete', id)
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
            <div key={msg.id} className="message">
              <div
                className="message-avatar clickable"
                style={{ background: getColor(msg.nickname) }}
                onClick={(e) => onUserClick?.({ user: msg.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                    onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, msg.nickname) }}
              >
                {msg.nickname[0]?.toUpperCase()}
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
                  <button className="message-delete" onClick={() => handleDeleteMessage(msg.id)} title="Delete">
                    <X size={14} />
                  </button>
                </div>
                {msg.content && <p className="message-text">{msg.content}</p>}
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

      <MessageInput onSend={handleSend} />

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
    </div>
  )
}
