import { useState, useRef } from 'react'
import { Paperclip, SendHorizonal, X } from 'lucide-react'

export default function MessageInput({ onSend }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

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

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleFileSelect(e) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      {file && (
        <div className="file-preview">
          <span>{file.name}</span>
          <button type="button" onClick={() => setFile(null)}><X size={14} /></button>
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
        <input
          ref={inputRef}
          type="text"
          className="message-input"
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          autoFocus
        />
        <button type="submit" className="send-btn" disabled={uploading || (!text.trim() && !file)}>
          <SendHorizonal size={16} />
        </button>
      </div>
    </form>
  )
}
