import { useAnimatedClose } from '../utils'
import { X } from 'lucide-react'

export default function LegalModal({ type, onClose }) {
  const { closing, animatedClose } = useAnimatedClose(onClose)

  const isPrivacy = type === 'privacy'
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Use'

  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={animatedClose}>
      <div className="legal-modal modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
        <button className="settings-close" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={animatedClose}>
          <X size={20} />
        </button>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{title}</h2>
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
          {isPrivacy ? (
            <>
              <h3>1. Data Collection</h3>
              <p>We use local storage ("cookies") to save your preferences, session token, and local settings. This is required for the application to function.</p>
              
              <h3 style={{ marginTop: '1rem' }}>2. Usage Data</h3>
              <p>Messages and media are processed by the server. The server stores chat history, uploaded files, and user profiles based on the host configuration.</p>
              
              <h3 style={{ marginTop: '1rem' }}>3. Third-party Access</h3>
              <p>No data is sent to external third-party services. All your communication remains strictly within the server hosting the application.</p>
            </>
          ) : (
            <>
              <h3>1. Acceptance of Terms</h3>
              <p>By accessing or using Medium, you agree to be bound by these terms. This app is provided "as is" without any warranties.</p>
              
              <h3 style={{ marginTop: '1rem' }}>2. User Code of Conduct</h3>
              <p>You agree to be respectful to other users on this network. Hate speech, harassment, spam, and illicit content are prohibited. Administrators reserve the right to remove access for any user violating these terms.</p>
              
              <h3 style={{ marginTop: '1rem' }}>3. Liability</h3>
              <p>The developers and hosts of Medium are not responsible for any user-generated content or actions taken by users within the application.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
