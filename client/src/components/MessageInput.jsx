import { useState, useRef, useEffect } from 'react'
import { Paperclip, SendHorizonal, X, Reply, Smile } from 'lucide-react'
import EmojiPicker from './EmojiPicker'
import GifPicker from './GifPicker'

export default function MessageInput({ onSend, replyTo, onCancelReply, users, nickname }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [activePicker, setActivePicker] = useState(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const pickerRef = useRef(null)

  const mentionUsers = mentionQuery !== null
    ? (() => {
        const q = mentionQuery.toLowerCase()
        const matched = [...new Set(users)].filter(u => u !== nickname && u.toLowerCase().includes(q))
        const extras = []
        if ('everyone'.includes(q)) extras.push('everyone')
        if ('here'.includes(q)) extras.push('here')
        return [...extras, ...matched]
      })()
    : []

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() && !file) return

    let attachmentData = null
    if (file) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        })
        if (res.ok) {
          attachmentData = await res.json()
        }
      } catch {}
      setUploading(false)
      setFile(null)
    }

    onSend(text.trim(), attachmentData)
    setText('')
    inputRef.current?.focus()
  }

  function handleChange(e) {
    const val = e.target.value
    const pos = e.target.selectionStart
    setText(val)

    const before = val.slice(0, pos)
    const atIdx = before.lastIndexOf('@')
    if (atIdx >= 0 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const query = before.slice(atIdx + 1)
      if (!/\s/.test(query) && query.length < 20) {
        setMentionQuery(query)
        setMentionIndex(0)
        return
      }
    }
    setMentionQuery(null)
  }

  function insertMention(user) {
    const pos = inputRef.current.selectionStart
    const before = text.slice(0, pos)
    const atIdx = before.lastIndexOf('@')
    const suffix = (user === 'everyone' || user === 'here') ? ' ' : ' '
    const newText = text.slice(0, atIdx) + '@' + user + suffix + text.slice(pos)
    setText(newText)
    setMentionQuery(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = atIdx + user.length + 2
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function handleKeyDown(e) {
    if (mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(prev => Math.min(prev + 1, mentionUsers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        insertMention(mentionUsers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleFileSelect(e) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  useEffect(() => {
    if (!activePicker) return
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setActivePicker(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activePicker])

  function handleEmojiSelect(emoji) {
    const pos = inputRef.current?.selectionStart ?? text.length
    const newText = text.slice(0, pos) + emoji + text.slice(pos)
    setText(newText)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = pos + emoji.length
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function handleGifSelect(url) {
    onSend(url, null)
  }

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      {replyTo && (
        <div className="reply-bar">
          <Reply size={14} />
          <span>Replying to <strong>{replyTo.nickname}</strong></span>
          <button type="button" className="reply-cancel" onClick={onCancelReply}><X size={14} /></button>
        </div>
      )}
      {file && (
        <div className="file-preview">
          <span>{file.name}</span>
          <button type="button" onClick={() => setFile(null)}><X size={14} /></button>
        </div>
      )}
      <div className="message-input-row" style={{ position: 'relative' }}>
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          <Paperclip size={20} />
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden />
        <input
          ref={inputRef}
          type="text"
          className="message-input"
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          autoFocus
        />
        <div className="input-actions-right">
          <button
            type="button"
            className={`picker-btn gif-text-btn ${activePicker === 'gif' ? 'active' : ''}`}
            onClick={() => setActivePicker(p => p === 'gif' ? null : 'gif')}
            title="GIF"
          >
            GIF
          </button>
          <button
            type="button"
            className={`picker-btn ${activePicker === 'emoji' ? 'active' : ''}`}
            onClick={() => setActivePicker(p => p === 'emoji' ? null : 'emoji')}
            title="Emoji"
          >
            <Smile size={20} />
          </button>
          <button type="submit" className="send-btn" disabled={uploading || (!text.trim() && !file)}>
            <SendHorizonal size={16} />
          </button>
        </div>
        {mentionUsers.length > 0 && (
          <div className="mention-dropdown">
            {mentionUsers.slice(0, 8).map((u, i) => (
              <div
                key={u}
                className={`mention-item ${i === mentionIndex ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(u) }}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <span className="mention-item-name">{u}</span>
              </div>
            ))}
          </div>
        )}
        {activePicker && (
          <div ref={pickerRef} className="picker-container">
            {activePicker === 'emoji' && (
              <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setActivePicker(null)} />
            )}
            {activePicker === 'gif' && (
              <GifPicker onSelect={handleGifSelect} onClose={() => setActivePicker(null)} />
            )}
          </div>
        )}
      </div>
    </form>
  )
}
