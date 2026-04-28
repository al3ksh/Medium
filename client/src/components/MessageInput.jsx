import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { Paperclip, SendHorizonal, X, Reply, Smile, ImageIcon, HelpCircle } from 'lucide-react'
import EmojiPicker from './EmojiPicker'
import GifPicker from './GifPicker'
import { showToast } from './ToastContainer'

export default function MessageInput({ onSend, replyTo, onCancelReply, users, nickname, channelId, socket, lastOwnMessageId, onRequestEditLast }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [activePicker, setActivePicker] = useState(null)
  const [nsfw, setNsfw] = useState(false)
  const [showMdHelp, setShowMdHelp] = useState(false)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const pickerRef = useRef(null)
  const btnRef = useRef(null)
  const typingTimeout = useRef(null)
  const formRef = useRef(null)
  const [pickerStyle, setPickerStyle] = useState({})
  const MAX_CHARS = 2000

  function autoResize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const emitTyping = useCallback(() => {
    if (!socket || !channelId) return
    socket.emit('typing:start', channelId)
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', channelId)
    }, 4000)
  }, [socket, channelId])

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

  function setFileWithPreview(f) {
    if (f && f.size > 20 * 1024 * 1024) {
      showToast?.('File too large (max 20 MB)')
      return
    }
    setFile(f)
    setNsfw(false)
    if (f && f.type?.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target.result)
      reader.readAsDataURL(f)
    } else {
      setFilePreview(null)
    }
  }

  function clearFile() {
    setFile(null)
    setFilePreview(null)
    setNsfw(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() && !file) return

    let attachmentData = null
    if (file) {
      setUploading(true)
      setUploadProgress(0)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const xhr = new XMLHttpRequest()
        attachmentData = await new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
          })
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
            else resolve(null)
          })
          xhr.addEventListener('error', () => resolve(null))
          xhr.open('POST', '/api/upload')
          xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`)
          xhr.send(formData)
        })
      } catch {}
      setUploading(false)
      setUploadProgress(0)
      clearFile()
    }

    onSend(text.trim(), attachmentData, nsfw)
    setText('')
    setNsfw(false)
    setTimeout(() => autoResize(), 0)
    clearTimeout(typingTimeout.current)
    socket?.emit('typing:stop', channelId)
    inputRef.current?.focus()
  }

  function handleChange(e) {
    const val = e.target.value.slice(0, MAX_CHARS)
    const pos = Math.min(e.target.selectionStart, val.length)
    setText(val)
    autoResize()
    emitTyping()

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
    if (e.key === 'ArrowUp' && text === '' && !mentionUsers.length && onRequestEditLast) {
      e.preventDefault()
      onRequestEditLast()
    }
  }

  function handleFileSelect(e) {
    const f = e.target.files?.[0]
    if (f) setFileWithPreview(f)
    e.target.value = ''
  }

  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) {
            e.preventDefault()
            setFileWithPreview(f)
            break
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  useEffect(() => {
    if (!showMdHelp && !activePicker) return
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setActivePicker(null)
        setShowMdHelp(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showMdHelp, activePicker])

  useEffect(() => {
    if (!activePicker) return
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) {
        setActivePicker(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activePicker])

  useEffect(() => {
    if (!showMdHelp) return
    function handleClick(e) {
      if (!e.target.closest('.md-help-popover') && !e.target.closest('.md-help-btn')) {
        setShowMdHelp(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMdHelp])

  // Position picker so it always fits on screen, opens to the left above the input
  useLayoutEffect(() => {
    if (!activePicker || !btnRef.current || !formRef.current) return
    const btn = btnRef.current.getBoundingClientRect()
    const form = formRef.current.getBoundingClientRect()
    const pw = 340 // picker width
    // Right-align with button area
    let left = btn.right - pw
    if (left < 8) left = 8
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8
    // Place bottom edge of picker at top edge of form, with small gap
    const bottom = window.innerHeight - form.top + 6
    // Compute available height above form (minus some padding)
    const availableH = form.top - 16
    const maxH = Math.min(400, availableH)
    setPickerStyle({
      position: 'fixed',
      left,
      bottom,
      zIndex: 300,
      '--picker-max-h': maxH + 'px',
    })
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
    <>
    <form className="message-input-form" onSubmit={handleSubmit} ref={formRef}>
      {replyTo && (
        <div className="reply-bar">
          <Reply size={14} />
          <span>Replying to <strong>{replyTo.nickname}</strong></span>
          <button type="button" className="reply-cancel" onClick={onCancelReply}><X size={14} /></button>
        </div>
      )}
      {file && (
        <div className="file-preview">
          <div className="file-preview-info">
            {filePreview ? (
              <div className="file-preview-thumb">
                <img src={filePreview} alt="" />
              </div>
            ) : (
              <div className="file-preview-icon">
                <ImageIcon size={20} />
              </div>
            )}
            <div className="file-preview-details">
              <span className="file-preview-name">{file.name}</span>
              <span className="file-preview-size">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          </div>
          {file.type?.startsWith('image/') && (
            <button
              type="button"
              className={`nsfw-toggle-pill${nsfw ? ' active' : ''}`}
              onClick={() => setNsfw(v => !v)}
              title="Mark as NSFW"
            >
              <span className="nsfw-toggle-dot" />
              <span className="nsfw-toggle-text">NSFW</span>
            </button>
          )}
          <button type="button" className="file-preview-remove" onClick={clearFile} disabled={uploading}><X size={16} /></button>
        </div>
      )}
      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          <span className="upload-progress-text">{uploadProgress < 100 ? `${uploadProgress}%` : 'Processing...'}</span>
        </div>
      )}
      <div className="message-input-row">
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          <Paperclip size={20} />
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} hidden />
        <textarea
          ref={inputRef}
          className="message-input"
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          autoFocus
          rows={1}
        />
        <div className="input-actions-right" ref={btnRef}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`picker-btn md-help-btn ${showMdHelp ? 'active' : ''}`}
              onClick={() => { setShowMdHelp(v => !v); setActivePicker(null) }}
              title="Markdown"
            >
              <HelpCircle size={20} />
            </button>
            {showMdHelp && (
              <div className="md-help-popover">
                <div className="md-help-title">Markdown</div>
                <div className="md-help-row"><code>**bold**</code> <span>bold</span></div>
                <div className="md-help-row"><code>*italic*</code> <span style={{ fontStyle: 'italic' }}>italic</span></div>
                <div className="md-help-row"><code>~~strike~~</code> <span style={{ textDecoration: 'line-through' }}>strike</span></div>
                <div className="md-help-row"><code>__underline__</code> <span style={{ textDecoration: 'underline' }}>underline</span></div>
                <div className="md-help-row"><code>`code`</code> <span>inline code</span></div>
                <div className="md-help-row"><code>```block```</code> <span>code block</span></div>
                <div className="md-help-row"><code>||spoiler||</code> <span>spoiler</span></div>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`picker-btn gif-text-btn ${activePicker === 'gif' ? 'active' : ''}`}
            onClick={() => { setActivePicker(p => p === 'gif' ? null : 'gif'); setShowMdHelp(false) }}
            title="GIF"
          >
            GIF
          </button>
          <button
            type="button"
            className={`picker-btn ${activePicker === 'emoji' ? 'active' : ''}`}
            onClick={() => { setActivePicker(p => p === 'emoji' ? null : 'emoji'); setShowMdHelp(false) }}
            title="Emoji"
          >
            <Smile size={20} />
          </button>
          <button type="submit" className="send-btn" disabled={uploading || (!text.trim() && !file)}>
            <SendHorizonal size={16} />
          </button>
          {text.length > MAX_CHARS * 0.8 && (
            <span className={`char-counter ${text.length >= MAX_CHARS ? 'over' : ''}`}>
              {MAX_CHARS - text.length}
            </span>
          )}
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
      </div>
    </form>
    {activePicker && (
      <div ref={pickerRef} className="picker-container" style={pickerStyle}>
        {activePicker === 'emoji' && (
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setActivePicker(null)} />
        )}
        {activePicker === 'gif' && (
          <GifPicker onSelect={handleGifSelect} onClose={() => setActivePicker(null)} />
        )}
      </div>
    )}
    </>
  )
}
