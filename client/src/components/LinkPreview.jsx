import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'

const cache = new Map()

export default function LinkPreview({ url }) {
  const [data, setData] = useState(cache.get(url) || null)

  useEffect(() => {
    if (cache.has(url)) { setData(cache.get(url)); return }
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d) { cache.set(url, d); setData(d) }
      })
      .catch(() => {})
  }, [url])

  if (!data || (!data.title && !data.desc && !data.image)) return (
    <a href={url} target="_blank" rel="noreferrer" className="link-preview-simple">
      <ExternalLink size={12} /> {url}
    </a>
  )

  return (
    <a href={url} target="_blank" rel="noreferrer" className="link-preview-card">
      {data.image && (
        <div className="link-preview-image">
          <img src={data.image} alt="" loading="lazy" />
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
