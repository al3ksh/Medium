import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../contexts/SocketContext'
import MessageInput from './MessageInput'

export default function Chat({ channel }) {
  const socket = useSocket()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
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
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function isImage(mimetype) {
    return mimetype && mimetype.startsWith('image/')
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="mobile-toggle" onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}>
          &#9776;
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
              <div className="message-avatar">{msg.nickname[0]?.toUpperCase()}</div>
              <div className="message-body">
                <div className="message-header">
                  <span className="message-nick">{msg.nickname}</span>
                  <span className="message-time">{formatTime(msg.created_at)}</span>
                  <button className="message-delete" onClick={() => handleDeleteMessage(msg.id)} title="Delete">
                    ×
                  </button>
                </div>
                {msg.content && <p className="message-text">{msg.content}</p>}
                {msg.attachment && isImage(msg.attachment_type) && (
                  <a href={msg.attachment} target="_blank" rel="noreferrer">
                    <img src={msg.attachment} alt="" className="message-image" loading="lazy" />
                  </a>
                )}
                {msg.attachment && !isImage(msg.attachment_type) && (
                  <a href={msg.attachment} target="_blank" rel="noreferrer" className="message-file">
                    📎 {msg.attachment_name || 'File'}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  )
}
