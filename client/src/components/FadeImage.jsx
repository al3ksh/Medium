import { useState } from 'react'

export default function FadeImage({ className, src, alt, loading, onClick }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <img
      src={src}
      alt={alt || ''}
      loading={loading || 'lazy'}
      onClick={onClick}
      onLoad={() => setLoaded(true)}
      className={`${className}${loaded ? ' loaded' : ''}`}
    />
  )
}
