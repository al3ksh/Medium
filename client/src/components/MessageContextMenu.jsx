import { useEffect, useRef } from 'react'
import { Reply, SmilePlus, Pencil, Trash2, Copy, Link } from 'lucide-react'

export default function MessageContextMenu({ msg, isOwn, x, y, channelName, onReply, onReact, onEdit, onDelete, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (x + rect.width > vw) ref.current.style.left = `${vw - rect.width - 8}px`
    if (y + rect.height > vh) ref.current.style.top = `${vh - rect.height - 8}px`
  }, [x, y])

  function copyText() {
    const text = msg.content || ''
    navigator.clipboard.writeText(text).catch(() => {})
    onClose()
  }

  function copyLinkWithMessage() {
    const text = msg.content || ''
    const link = `${window.location.origin}#${channelName}`
    navigator.clipboard.writeText(`${text}\n${link}`).catch(() => {})
    onClose()
  }

  return (
    <div ref={ref} className="msg-context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button className="msg-ctx-item" onClick={onReply}>
        <Reply size={14} /> Reply
      </button>
      <button className="msg-ctx-item" onClick={onReact}>
        <SmilePlus size={14} /> Add Reaction
      </button>
      <div className="msg-ctx-sep" />
      <button className="msg-ctx-item" onClick={copyText}>
        <Copy size={14} /> Copy Text
      </button>
      <button className="msg-ctx-item" onClick={copyLinkWithMessage}>
        <Link size={14} /> Copy Link with Message
      </button>
      <div className="msg-ctx-sep" />
      {isOwn && (
        <button className="msg-ctx-item" onClick={onEdit}>
          <Pencil size={14} /> Edit Message
        </button>
      )}
      {isOwn && (
        <button className="msg-ctx-item msg-ctx-danger" onClick={onDelete}>
          <Trash2 size={14} /> Delete Message
        </button>
      )}
    </div>
  )
}
