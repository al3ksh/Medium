import { useEffect, useState } from 'react'

let addToast = null

export function showToast(message, user) {
  addToast?.({ message, user, id: Date.now() })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    addToast = (toast) => {
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 4000)
    }
    return () => { addToast = null }
  }, [])

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-message">{t.message}</span>
          {t.user && <span className="toast-user"> — {t.user}</span>}
        </div>
      ))}
    </div>
  )
}
