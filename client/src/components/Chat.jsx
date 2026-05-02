import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Menu, X, Paperclip, Reply, Pencil, SmilePlus, ChevronDown, FileText, ChevronUp, Download, Maximize2 } from 'lucide-react'
import { useSocket } from '../contexts/SocketContext'
import { useUserColor, useUserAvatar, useAuth, useNickUserIds } from '../contexts/AuthContext'
import { loadSettings, useAnimatedClose } from '../utils'
import { useLongPress } from '../utils/gestures'
import { renderMarkdown } from '../utils/markdown.jsx'
import { isChannelMuted, getNotifSetting } from './ChannelContextMenu'
import FadeImage from './FadeImage'
import LinkPreview from './LinkPreview'
import MessageInput from './MessageInput'
import MessageContextMenu from './MessageContextMenu'
import EmojiPicker from './EmojiPicker'
import ConfirmModal from './ConfirmModal'
import UserList from './UserList'

const TXT_MAX_LINES = 150
const TXT_MAX_CHARS = 50000
const TXT_FETCH_MAX = 200000
const TXT_MODAL_MAX = 1000000

function sanitizeTxt(raw) {
  return raw.replace(/[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0B\x0C\x0E\x0F\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D\x1E\x1F\x7F]/g, '')
}

function TxtViewerModal({ data, name, url, onClose }) {
  const { closing, animatedClose } = useAnimatedClose(onClose)

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') animatedClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [animatedClose])

  return (
    <div className={`txt-viewer-overlay${closing ? ' closing' : ''}`} onClick={animatedClose}>
      <button className="image-viewer-close" onClick={animatedClose}>
        <X size={24} />
      </button>
      <div className="txt-viewer-modal" onClick={e => e.stopPropagation()}>
        <div className="txt-viewer-titlebar">
          <FileText size={16} />
          <span>{name || 'text.txt'}</span>
          <span className="txt-viewer-meta">
            {!data.loading && `${data.totalLines?.toLocaleString()} lines \u00B7 ${(data.totalChars / 1024).toFixed(1)} KB`}
          </span>
          <a href={url} download={name || 'text.txt'} className="txt-preview-download" title="Download">
            <Download size={14} />
          </a>
        </div>
        {data.loading ? (
          <div className="txt-viewer-loading"><span className="txt-preview-spinner" /></div>
        ) : (
          <pre className="txt-viewer-content"><code>{data.displayText}</code></pre>
        )}
      </div>
    </div>
  )
}

function TxtPreview({ url, name }) {
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)

  const loadFile = useCallback(async (full = false) => {
    try {
      const res = await fetch(url)
      const ct = res.headers.get('content-type') || ''
      if (!ct.startsWith('text/plain') && !ct.startsWith('text/')) {
        return { displayText: 'Unsupported file type.', totalLines: 0, totalChars: 0, truncated: false, error: true }
      }
      if (full) {
        const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
        if (contentLength > TXT_MODAL_MAX) {
          return { displayText: `This file is too large to display (${(contentLength / 1024 / 1024).toFixed(1)} MB).\n\nDownload it to view the full content.`, totalLines: 0, totalChars: contentLength, truncated: false, error: true }
        }
      }
      const raw = await res.text()
      if (full && raw.length > TXT_MODAL_MAX) {
        return { displayText: `This file is too large to display (${(raw.length / 1024 / 1024).toFixed(1)} MB).\n\nDownload it to view the full content.`, totalLines: raw.split('\n').length, totalChars: raw.length, truncated: false, error: true }
      }
      if (!full && raw.length > TXT_FETCH_MAX) {
        return { displayText: `File too large to preview (${(raw.length / 1024).toFixed(0)} KB). Download to view.`, totalLines: raw.split('\n').length, totalChars: raw.length, truncated: false, error: true }
      }
      const text = sanitizeTxt(raw)
      const lines = text.split('\n')
      const totalLines = lines.length
      const totalChars = text.length
      if (full) {
        return { displayText: text, totalLines, totalChars, truncated: false, lines }
      }
      const truncated = totalLines > TXT_MAX_LINES || totalChars > TXT_MAX_CHARS
      let displayText = text
      if (truncated) {
        displayText = lines.slice(0, TXT_MAX_LINES).join('\n')
        if (displayText.length > TXT_MAX_CHARS) {
          displayText = displayText.slice(0, TXT_MAX_CHARS)
        }
      }
      return { displayText, totalLines, totalChars, truncated }
    } catch {
      return { displayText: 'Failed to load file.', totalLines: 0, totalChars: 0, truncated: false, error: true }
    }
  }, [url])

  const toggle = useCallback(async () => {
    if (!expanded && data === null) {
      setLoading(true)
      const result = await loadFile()
      setData(result)
      setLoading(false)
    }
    setExpanded(e => !e)
  }, [expanded, data, loadFile])

  const openModal = useCallback(async (e) => {
    e.stopPropagation()
    setModal({ loading: true })
    const result = await loadFile(true)
    setModal(result)
  }, [loadFile])

  return (
    <div className="txt-preview">
      <div className="txt-preview-header" onClick={toggle}>
        <div className="file-preview-info">
          <div className="file-preview-icon">
            <FileText size={20} />
          </div>
          <div className="file-preview-details">
            <span className="file-preview-name">{name || 'text.txt'}</span>
            <span className="file-preview-size">
              {data ? `${(data.totalChars / 1024).toFixed(1)} KB` : 'Text Document'}
            </span>
          </div>
        </div>
        <div className="txt-preview-actions">
          <button className="txt-preview-view" onClick={openModal} title="View in fullscreen">
            <Maximize2 size={14} />
          </button>
          <a
            href={url}
            download={name || 'text.txt'}
            className="txt-preview-download"
            onClick={e => e.stopPropagation()}
            title="Download"
          >
            <Download size={14} />
          </a>
          {loading
            ? <span className="txt-preview-spinner" />
            : expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
          }
        </div>
      </div>
      {expanded && data !== null && (
        <>
          <pre className={`txt-preview-content${data.error ? ' txt-preview-error' : ''}`}>
            <code>{data.displayText}{data.truncated && `\n\n... and ${Math.max(0, data.totalLines - TXT_MAX_LINES).toLocaleString()} more lines`}</code>
          </pre>
          {data.truncated && (
            <div className="txt-preview-truncated">
              Showing first {TXT_MAX_LINES} of {data.totalLines.toLocaleString()} lines ({(data.totalChars / 1024).toFixed(1)} KB). <button className="txt-preview-link" onClick={openModal}>View full file</button> or <a href={url} download={name || 'text.txt'}>download</a>
            </div>
          )}
        </>
      )}
      {modal && (
        <TxtViewerModal data={modal} name={name} url={url} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

function MembersSheet({ users, onUserClick, onUserContextMenu, onClose }) {
  const sheetRef = useRef(null)
  const expandedRef = useRef(false)

  useEffect(() => {
    const el = sheetRef.current
    if (!el || window.innerWidth > 900) return

    let startY = 0
    let currentY = 0
    let isSwiping = false

    const onTouchStart = (e) => {
      const list = e.target.closest('.members-sheet-list')
      if (list && list.scrollTop > 0) return
      startY = e.touches[0].clientY
      currentY = startY
      isSwiping = true
    }

    const onTouchMove = (e) => {
      if (!isSwiping) return
      currentY = e.touches[0].clientY
      const dy = currentY - startY
      if (expandedRef.current) {
        if (dy > 0) {
          if (e.cancelable) e.preventDefault()
          el.style.transform = `translateY(${dy}px)`
          el.style.transition = 'none'
        }
      } else {
        if (dy > 0) {
          if (e.cancelable) e.preventDefault()
          el.style.transform = `translateY(${dy}px)`
          el.style.transition = 'none'
        } else if (dy < -40) {
          el.classList.add('expanded')
          el.style.transform = ''
          expandedRef.current = true
          isSwiping = false
        }
      }
    }

    const onTouchEnd = () => {
      if (!isSwiping) return
      isSwiping = false
      const dy = currentY - startY
      if (dy > 120) {
        el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out'
        el.style.transform = `translateY(100vh)`
        el.style.opacity = '0'
        if (el.parentElement) {
          el.parentElement.style.transition = 'opacity 0.2s ease-out'
          el.parentElement.style.opacity = '0'
        }
        setTimeout(() => onClose(), 200)
      } else {
        el.style.transform = ''
        el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        setTimeout(() => { el.style.transition = '' }, 200)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onClose])

  function animateClose() {
    const el = sheetRef.current
    if (!el) { onClose(); return }
    el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out'
    el.style.transform = 'translateY(100vh)'
    el.style.opacity = '0'
    if (el.parentElement) {
      el.parentElement.style.transition = 'opacity 0.2s ease-out'
      el.parentElement.style.opacity = '0'
    }
    setTimeout(() => onClose(), 200)
  }

  return (
    <div className="members-sheet-backdrop" onClick={animateClose}>
      <div className="members-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <div className="members-sheet-handle" />
        <div className="members-sheet-header">Members — {users.length}</div>
        <div className="members-sheet-list">
          <UserList users={users} onUserClick={onUserClick} onUserContextMenu={onUserContextMenu} />
        </div>
      </div>
    </div>
  )
}

function hashColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 70%, 60%)`
}

export default function Chat({ channel, users, nickname, onUserClick, onUserContextMenu, onToggleSidebar }) {
  const socket = useSocket()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const auth = useAuth()
  const myUserId = auth?.userId
  const nickUserIds = useNickUserIds()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [imageViewer, setImageViewer] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [revealedNsfw, setRevealedNsfw] = useState(new Set())
  const [newMsgId, setNewMsgId] = useState(null)
  const [msgContextMenu, setMsgContextMenu] = useState(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [swipingMsgId, setSwipingMsgId] = useState(null)
  const [swipeX, setSwipeX] = useState(0)
  const [showMembers, setShowMembers] = useState(false)
  const chatRef = useRef(null)
  const isAtBottom = useRef(true)
  const topRef = useRef(null)
  const hasMore = useRef(true)
  const loadingMore = useRef(false)
  const scrollAnchor = useRef(null)

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  const headerLongPress = useLongPress(() => {
    setShowMembers(true)
  }, 500)

  function toggleNsfw(msgId, e) {
    e.stopPropagation()
    setRevealedNsfw(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }
  const [reactPicker, setReactPicker] = useState(null)
  const [reactPickerPos, setReactPickerPos] = useState({ x: 0, y: 0 })
  const bottomRef = useRef(null)
  const prevMsgCount = useRef(0)
  const token = localStorage.getItem('token')

  useEffect(() => {
    setLoading(true)
    hasMore.current = true
    loadingMore.current = false
    fetch(`/api/messages/${channel.id}?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages(data)
        if (data.length < 50) hasMore.current = false
        setLoading(false)
      })

    socket.emit('channel:join', channel.id)

    function onNewMessage(msg) {
      if (msg.channel_id === channel.id) {
        setMessages((prev) => [...prev, msg])
        setNewMsgId(msg.id)
        setTimeout(() => setNewMsgId(null), 300)
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
    const el = topRef.current
    const root = chatRef.current
    if (!el || !root) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      if (!hasMore.current || loadingMore.current) return
      loadingMore.current = true
      const oldest = messages[0]?.created_at
      if (!oldest) { loadingMore.current = false; return }
      fetch(`/api/messages/${channel.id}?before=${oldest}&limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.length === 0) { hasMore.current = false; loadingMore.current = false; return }
          if (data.length < 50) hasMore.current = false
          scrollAnchor.current = root.scrollHeight - root.scrollTop
          setMessages((prev) => [...data, ...prev])
          loadingMore.current = false
        })
    }, { root, threshold: 0, rootMargin: '200px 0px 0px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [channel.id, messages.length])

  useEffect(() => {
    if (scrollAnchor.current !== null) {
      const root = chatRef.current
      if (root) root.scrollTop = root.scrollHeight - scrollAnchor.current
      scrollAnchor.current = null
    }
  }, [messages.length])

useEffect(() => {
    const el = chatRef.current
    if (!el) return
    function handleScroll() {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
      isAtBottom.current = atBottom
      setShowScrollBtn(!atBottom)
      if (atBottom) setUnreadCount(0)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const instant = prevMsgCount.current === 0
      if (isAtBottom.current || instant) {
        bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
        if (instant) {
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 100)
        }
      } else {
        setShowScrollBtn(true)
        setUnreadCount((c) => c + 1)
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
    let x = rect.right - 340
    if (x < 8) x = 8
    
    let posStyle = {}
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    
    if (spaceBelow >= 400 || spaceBelow > spaceAbove) {
      posStyle = { left: x, top: rect.bottom + 4 }
    } else {
      posStyle = { left: x, bottom: window.innerHeight - rect.top + 4 }
    }
    
    setReactPickerPos(posStyle)
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

  useEffect(() => {
    if (!msgContextMenu) return
    function close() { setMsgContextMenu(null) }
    function handleKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('click', close)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', handleKey)
    }
  }, [msgContextMenu])

  function handleSend(content, attachmentData, nsfw) {
    socket.emit('message:send', {
      channelId: channel.id,
      content,
      attachment: attachmentData?.url || null,
      attachmentName: attachmentData?.originalName || null,
      attachmentType: attachmentData?.mimetype || null,
      replyTo: replyTo?.id || null,
      nsfw: !!nsfw,
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

  const URL_REGEX = /https?:\/\/[^\s<>"']+/g

  function extractUrls(text) {
    if (!text) return []
    return [...new Set(text.match(URL_REGEX) || [])]
  }

  function renderContent(text) {
    const sortedUsers = [...users].sort((a, b) => b.length - a.length)
    let result = [text]
    for (const user of sortedUsers) {
      const next = []
      for (const part of result) {
        if (typeof part !== 'string') { next.push(part); continue }
        const regex = new RegExp(`@(${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=\\s|$|[^\\w])`, 'g')
        let lastIndex = 0
        let match
        const pieces = []
        while ((match = regex.exec(part)) !== null) {
          if (match.index > lastIndex) pieces.push(part.slice(lastIndex, match.index))
          pieces.push({ mention: user, full: match[0] })
          lastIndex = regex.lastIndex
        }
        if (lastIndex < part.length) pieces.push(part.slice(lastIndex))
        next.push(...pieces)
      }
      result = next
    }
    if (sortedUsers.length === 0) {
      const everyoneRegex = /@(everyone|here)(?=\s|$|[^\w])/g
      const parts = text.split(everyoneRegex)
      return parts.map((part, i) => {
        if (part === 'everyone' || part === 'here') {
          return <span key={i} className="mention mention-everyone">@{part}</span>
        }
        return <span key={i}>{renderMarkdown(part)}</span>
      })
    }
    return result.map((part, i) => {
      if (typeof part === 'object' && part.mention) {
        const name = part.mention
        if (name === 'everyone' || name === 'here') {
          return <span key={i} className="mention mention-everyone">{part.full}</span>
        }
        return <span key={i} className="mention" style={{ color: getColor(name) }} onClick={(e) => { e.stopPropagation(); onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 }) }}>{part.full}</span>
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

  useEffect(() => {
    if (!imageViewer) return
    function handleKey(e) {
      if (e.key === 'Escape') setImageViewer(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [imageViewer])

  return (
    <div className="chat-container">
      <div className="chat-header" {...(isMobile ? headerLongPress : {})}>
        <div className="mobile-toggle" onClick={() => onToggleSidebar?.()}>
          <Menu size={20} />
        </div>
        <span className="chat-channel-name"># {channel.name}</span>
        <span className="chat-header-members" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }} {...(isMobile ? { onClick: () => setShowMembers(true), className: 'chat-header-members clickable' } : {})}>{users.length}</span>
      </div>

      <div className="chat-messages" ref={chatRef}>
        {loading ? (
          <div className="chat-loading">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} className={`skeleton-msg${i > 0 && (i === 2 || i === 5) ? '' : ''}`}>
                <div className="skeleton-msg-avatar" />
                <div className="skeleton-msg-body">
                  <div className="skeleton-msg-header">
                    <div className="skeleton-msg-nick" style={{ width: `${55 + (i * 19) % 45}px` }} />
                    <div className="skeleton-msg-time" />
                  </div>
                  <div className="skeleton-msg-line" style={{ width: `${45 + (i * 17) % 40}%` }} />
                  {i % 3 !== 1 && <div className="skeleton-msg-line short" style={{ width: `${25 + (i * 13) % 30}%` }} />}
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">No messages yet. Say something!</div>
        ) : (
          <React.Fragment>
          <div ref={topRef} style={{ height: 1 }} />
          {messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null
            const grouped = prev && prev.nickname === msg.nickname && prev.user_id === msg.user_id && (msg.created_at - prev.created_at) < 300
            const currentUid = nickUserIds[msg.nickname]
            const isImpersonated = msg.user_id && currentUid && msg.user_id !== currentUid
            const isOwn = msg.user_id === myUserId
            const isEditing = editingId === msg.id
            return (
            <div key={msg.id} className={`message-swipe-wrapper${swipingMsgId === msg.id ? ' swiping' : ''}`} style={swipingMsgId === msg.id ? { transform: `translateX(${swipeX}px)` } : undefined}>
              {swipingMsgId === msg.id && swipeX < -30 && (
                <div className="swipe-reply-indicator"><Reply size={18} /></div>
              )}
            <div id={`msg-${msg.id}`} className={`message${grouped ? ' message-grouped' : ''}${isImpersonated ? ' message-impersonator' : ''}${msg.id === newMsgId ? ' msg-new' : ''}${reactPicker === msg.id ? ' message-active' : ''}`}
              onContextMenu={(e) => {
                e.preventDefault()
                setMsgContextMenu({ msg, isOwn, x: e.clientX, y: e.clientY })
              }}
              onTouchStart={(e) => {
                const t = e.touches[0]
                msg._lpX = t.clientX
                msg._lpY = t.clientY
                msg._swipeStartX = t.clientX
                msg._swipeActive = true
                msg._lpTimer = setTimeout(() => {
                  msg._swipeActive = false
                  setMsgContextMenu({ msg, isOwn, x: msg._lpX, y: msg._lpY })
                }, 500)
              }}
              onTouchMove={(e) => {
                const t = e.touches[0]
                const dx = t.clientX - (msg._lpX || 0)
                const dy = Math.abs(t.clientY - (msg._lpY || 0))
                if (msg._lpTimer && (Math.abs(dx) > 10 || dy > 10)) {
                  clearTimeout(msg._lpTimer)
                  msg._lpTimer = null
                }
                if (dy < Math.abs(dx) && msg._swipeActive) {
                  const raw = t.clientX - (msg._swipeStartX || 0)
                  const clamped = Math.max(-80, Math.min(raw, 0))
                  if (clamped < -5) {
                    setSwipingMsgId(msg.id)
                    setSwipeX(clamped)
                  }
                }
              }}
              onTouchEnd={() => {
                if (msg._lpTimer) { clearTimeout(msg._lpTimer); msg._lpTimer = null }
                if (msg._swipeActive && swipeX < -40 && swipingMsgId === msg.id) {
                  setReplyTo(msg)
                }
                msg._swipeActive = false
                setSwipingMsgId(null)
                setSwipeX(0)
              }}
              onTouchCancel={() => {
                if (msg._lpTimer) { clearTimeout(msg._lpTimer); msg._lpTimer = null }
                msg._swipeActive = false
                setSwipingMsgId(null)
                setSwipeX(0)
              }}
            >
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
                      onBlur={() => { setEditingId(null); setEditText('') }}
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
                {!isEditing && extractUrls(msg.content).filter(u => !isGifUrl(u)).map((url, ui) => (
                  <LinkPreview key={ui} url={url} />
                ))}
                {msg.content && isGifUrl(msg.content) && (
                  <div className="message-gif-container">
                    <FadeImage src={msg.content.trim()} alt="GIF" className="message-gif" onClick={() => setImageViewer(msg.content.trim())} />
                  </div>
                )}
                {msg.attachment && isImage(msg.attachment_type) && (
                  <div className={`message-image-container${!!msg.nsfw ? ' nsfw-blur-container' : ''}`}>
                    <FadeImage
                      src={msg.attachment}
                      alt=""
                      className={`message-image${!!msg.nsfw && !revealedNsfw.has(msg.id) ? ' nsfw-blur' : ''}`}
                      onClick={() => !msg.nsfw || revealedNsfw.has(msg.id) ? setImageViewer(msg.attachment) : undefined}
                    />
                    {!!msg.nsfw && (
                      <div
                        className={`nsfw-label${revealedNsfw.has(msg.id) ? ' revealed' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleNsfw(msg.id, e)
                        }}
                      >
                        {revealedNsfw.has(msg.id) ? 'NSFW' : 'NSFW — click to reveal'}
                      </div>
                    )}
                  </div>
                )}
                {msg.attachment && !isImage(msg.attachment_type) && msg.attachment_type === 'text/plain' && (
                  <TxtPreview url={msg.attachment} name={msg.attachment_name} />
                )}
                {msg.attachment && !isImage(msg.attachment_type) && msg.attachment_type !== 'text/plain' && (
                  <a href={msg.attachment} target="_blank" rel="noreferrer" className="message-file">
                    <div className="file-preview-info">
                      <div className="file-preview-icon">
                        <Paperclip size={20} />
                      </div>
                      <div className="file-preview-details">
                        <span className="file-preview-name">{msg.attachment_name || 'File'}</span>
                        <span className="file-preview-size">Click to download</span>
                      </div>
                    </div>
                    <Download size={16} className="message-file-download" />
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
             </div>
           )})}
           </React.Fragment>
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

      {showScrollBtn && (
        <div className="scroll-bottom-bar" onClick={() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          setShowScrollBtn(false)
          setUnreadCount(0)
        }}>
          <ChevronDown size={14} />
          <span>Newer{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
        </div>
      )}

      <MessageInput onSend={handleSend} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} users={users} nickname={nickname} channelId={channel.id} socket={socket} onRequestEditLast={() => {
        const lastOwn = [...messages].reverse().find(m => m.nickname === nickname && m.user_id === myUserId)
        if (lastOwn) { setEditingId(lastOwn.id); setEditText(lastOwn.content || '') }
      }} />

      {reactPicker !== null && (
        <div className="reaction-picker-fixed" style={{ ...reactPickerPos, zIndex: 100 }}>
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
      {msgContextMenu && (
        <MessageContextMenu
          msg={msgContextMenu.msg}
          isOwn={msgContextMenu.isOwn}
          x={msgContextMenu.x}
          y={msgContextMenu.y}
          channelName={channel.name}
          onReply={() => { setReplyTo(msgContextMenu.msg); setMsgContextMenu(null) }}
          onReact={(e) => { openReactPicker(e, msgContextMenu.msg.id); setMsgContextMenu(null) }}
          onEdit={() => { startEdit(msgContextMenu.msg); setMsgContextMenu(null) }}
          onDelete={() => { handleDeleteMessage(msgContextMenu.msg.id, {}); setMsgContextMenu(null) }}
          onClose={() => setMsgContextMenu(null)}
        />
      )}
      {showMembers && (
        <MembersSheet
          users={users}
          onUserClick={onUserClick}
          onUserContextMenu={onUserContextMenu}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  )
}
