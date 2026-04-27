import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import FadeImage from './FadeImage'

const cache = new Map()

export default function LinkPreview({ url }) {
  const [data, setData] = useState(cache.get(url) || null)
  const [loading, setLoading] = useState(!cache.has(url))

  useEffect(() => {
    if (cache.has(url)) { setData(cache.get(url)); return }
    setLoading(true)
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d) { cache.set(url, d); setData(d) }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [url])

  if (loading) return (
    <div className="link-preview-card skeleton-card">
      <div className="link-preview-image skeleton-shimmer" />
      <div className="link-preview-info">
        <span className="skeleton-line skeleton-domain" />
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-desc" />
      </div>
    </div>
  )

  if (!data || (!data.title && !data.desc && !data.image)) return (
    <a href={url} target="_blank" rel="noreferrer" className="link-preview-simple">
      <ExternalLink size={12} /> {url}
    </a>
  )

  return (
    <a href={url} target="_blank" rel="noreferrer" className="link-preview-card">
      {data.image && (
        <div className="link-preview-image">
          <FadeImage src={data.image} alt="" />
        </div>
      )}
      <div className="link-preview-info">
        <span className="link-preview-domain">{data.domain}</span>
        {data.title && <span className="link-preview-title">{data.title}</span>}
        {data.desc && <span className="link-preview-desc">{data.desc.length > 120 ? data.desc.slice(0, 120) + '...' : data.desc}</span>}
      </div>
    </a>
  )
}
