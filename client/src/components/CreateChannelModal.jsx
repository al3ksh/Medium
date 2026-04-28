import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useAnimatedClose } from '../utils'

export default function CreateChannelModal({ type, onConfirm, onCancel }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  const { closing, animatedClose } = useAnimatedClose(onCancel)

  useEffect(() => {
    inputRef.current?.focus()
    function handleKey(e) {
      if (e.key === 'Escape') animatedClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [animatedClose])

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onConfirm(name.trim())
  }

  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={animatedClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <Plus size={18} />
          <h3>Create {type} channel</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="create-channel-input-wrap">
            <label>Channel Name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`new-${type}-channel`}
              maxLength={30}
            />
          </div>
          <div className="confirm-modal-actions">
            <button type="button" className="confirm-btn cancel" onClick={animatedClose}>Cancel</button>
            <button type="submit" className="confirm-btn primary" disabled={!name.trim()}>Create Channel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
