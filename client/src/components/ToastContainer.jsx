import { useEffect, useState, useCallback } from 'react'

let addToast = null

export function showToast(message, user) {
  addToast?.({ message, user, id: Date.now() })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    addToast = (toast) => {
      setToasts((prev) => [...prev, { ...toast, exiting: false }])
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => t.id === toast.id ? { ...t, exiting: true } : t))
        setTimeout(() => removeToast(toast.id), 300)
      }, 3700)
    }
    return () => { addToast = null }
  }, [removeToast])

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.exiting ? ' toast-exit' : ''}`}>
          <span className="toast-message">{t.message}</span>
          {t.user && <span className="toast-user"> — {t.user}</span>}
        </div>
      ))}
    </div>
  )
}
