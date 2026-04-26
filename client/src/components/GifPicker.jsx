import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'

export default function GifPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    fetch('/api/gif/trending')
      .then(r => r.json())
      .then(setTrending)
      .catch(() => {})
  }, [])

  const searchGifs = useCallback((q) => {
    if (!q.trim()) { setGifs([]); return }
    setLoading(true)
    fetch(`/api/gif/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => { setGifs(data); setLoading(false) })
      .catch(() => { setGifs([]); setLoading(false) })
  }, [])

  function handleSearchChange(e) {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchGifs(val), 400)
  }

  const items = search ? gifs : trending

  return (
    <div className="picker-panel gif-picker" onClick={(e) => e.stopPropagation()}>
      <div className="picker-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search GIFs..."
          value={search}
          onChange={handleSearchChange}
          autoFocus
        />
      </div>
      <div className="gif-grid">
        {loading && <div className="gif-loading">Searching...</div>}
        {!loading && items.length === 0 && search && (
          <div className="gif-loading">No GIFs found</div>
        )}
        {!loading && items.map(gif => (
          <button
            key={gif.id}
            className="gif-item"
            onClick={() => { onSelect(gif.url); onClose() }}
          >
            <img src={gif.preview} alt={gif.title} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}
