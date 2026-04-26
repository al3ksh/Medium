import { useRef, useEffect, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'

export default function ConfirmModal({ title, message, confirmLabel, danger, tip, onConfirm, onCancel }) {
  const confirmRef = useRef(null)
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    confirmRef.current?.focus()
    function handleKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <AlertTriangle size={18} className={danger ? 'text-danger' : ''} />
          <h3>{title}</h3>
          {tip && (
            <div className="confirm-tip-wrap">
              <HelpCircle
                size={14}
                className="confirm-tip-icon"
                onClick={(e) => { e.stopPropagation(); setShowTip(v => !v) }}
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
              />
              {showTip && <div className="confirm-tip-bubble">{tip}</div>}
            </div>
          )}
        </div>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>Cancel</button>
          <button
            ref={confirmRef}
            className={`confirm-btn ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
