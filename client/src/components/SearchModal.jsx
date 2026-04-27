import { useState, useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'

export default function SearchModal({ onClose, channels, nickname }) {
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState('')
  const [fromUser, setFromUser] = useState('')
  const [includePrivate, setIncludePrivate] = useState(false)
  const [privatePass, setPrivatePass] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query, channel, fromUser, includePrivate, privatePass])

  async function doSearch() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: query.trim() })
      if (channel) params.set('channel', channel)
      if (fromUser) params.set('nickname', fromUser)
      if (includePrivate && privatePass) params.set('private_password', privatePass)
      const res = await fetch(`/api/messages/search/query?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (res.ok) setResults(await res.json())
    } catch {}
    setLoading(false)
  }

  function formatTime(ts) {
    return new Date(ts * 1000).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function highlight(text) {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i}>{p}</mark> : p)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h2>Search Messages</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="search-filters">
          <div className="search-input-row">
            <Search size={18} className="search-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
            />
          </div>
          <div className="search-filter-row">
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">All channels</option>
              {channels.filter(c => c.type === 'text').map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="From user..."
              value={fromUser}
              onChange={(e) => setFromUser(e.target.value)}
            />
          </div>
          <label className="search-private-toggle">
            <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} />
            <span>Include private channels</span>
          </label>
          {includePrivate && (
            <input
              type="password"
              placeholder="Private channel password"
              value={privatePass}
              onChange={(e) => setPrivatePass(e.target.value)}
              className="search-private-input"
            />
          )}
        </div>

        <div className="search-results">
          {loading && <div className="search-loading">Searching...</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="search-empty">No results found</div>
          )}
          {results.map((msg) => (
            <div key={msg.id} className="search-result" onClick={() => { onClose(msg) }}>
              <div className="search-result-header">
                <span className="search-result-channel">#{msg.channel_name}</span>
                <span className="search-result-nick">{msg.nickname}</span>
                <span className="search-result-time">{formatTime(msg.created_at)}</span>
              </div>
              <div className="search-result-content">{highlight(msg.content || '')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
