import { useState } from 'react'
import { useVoice } from '../contexts/VoiceContext'
import { useAvatarColor, useUserColor, useUserAvatar } from '../contexts/AuthContext'
import { nicknameToColor } from '../utils'
import { Volume2, Mic, MicOff, Headphones, PhoneOff } from 'lucide-react'
import ConnectionDetailsModal from './ConnectionDetailsModal'

function SignalBars({ ping }) {
  return (
    <div className="signal-bars" title={`${ping}ms`} data-quality={ping <= 70 ? '4' : ping <= 150 ? '3' : ping <= 300 ? '2' : '1'}>
      {[1, 2, 3, 4].map((level) => (
        <div key={level} className={`signal-bar ${ping <= (level === 1 ? 300 : level === 2 ? 150 : level === 3 ? 70 : 0) ? 'active' : ''}`} style={{ height: `${3 + level * 3}px` }} />
      ))}
    </div>
  )
}

export default function VoiceChannel({ channel, onUserClick, onUserContextMenu }) {
  const { joined, voiceChannel, peers, speaking, joinVoice, leaveVoice, nickname, socketId, isMuted, isDeafened, toggleMute, toggleDeafen, ping } = useVoice()
  const selfColor = useAvatarColor()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const isActive = joined && voiceChannel?.id === channel.id
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="voice-container">
      <div className="voice-header">
        <Volume2 size={20} />
        <span>{channel.name}</span>
      </div>

      <div className="voice-body">
        {isActive && peers.length === 0 && (
          <p className="voice-empty-top">You're alone here. Invite someone!</p>
        )}

        {isActive && (
          <div className={`voice-grid count-${peers.length + 1}`}>
            <div
              className={`voice-peer clickable speaking-${speaking[socketId] ? 'active' : 'idle'}`}
              onClick={(e) => onUserClick?.({ user: nickname, x: e.clientX + 10, y: e.clientY - 100 })}
            >
              <div className="voice-avatar" style={getAvatar(nickname) ? {} : { background: selfColor }}>
                {getAvatar(nickname) ? <img src={getAvatar(nickname)} alt="" /> : nickname[0]?.toUpperCase()}
              </div>
              <div className="voice-user-badge">
                <span className="voice-name">{nickname} (you)</span>
                {isMuted && !isDeafened && <MicOff size={16} className="voice-status-icon-inline" />}
                {isDeafened && <Headphones size={16} className="voice-status-icon-inline deafened" />}
              </div>
            </div>

            {peers.map((p) => (
              <div
                key={p.socketId}
                className={`voice-peer clickable speaking-${speaking[p.socketId] ? 'active' : 'idle'}`}
                onClick={(e) => onUserClick?.({ user: p.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, p.nickname) }}
              >
                <div className="voice-avatar" style={getAvatar(p.nickname) ? {} : { background: getColor(p.nickname) }}>
                  {getAvatar(p.nickname) ? <img src={getAvatar(p.nickname)} alt="" /> : p.nickname[0]?.toUpperCase()}
                </div>
                <div className="voice-user-badge">
                  <span className="voice-name">{p.nickname}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isActive && (
          <p className="voice-empty">Click below to join this voice channel.</p>
        )}
      </div>

      <div className="voice-controls">
        {!isActive ? (
          <button className="voice-join-btn" onClick={() => joinVoice(channel)}>
            Join Voice
          </button>
        ) : (
          <div className="voice-toolbar">
            <div className="voice-connected-info">
              <span className="voice-connected-label">Voice Connected</span>
            </div>
            <div className="voice-toolbar-actions">
              <button className={`voice-tool-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button className={`voice-tool-btn deafen ${isDeafened ? 'active' : ''}`} onClick={toggleDeafen} title={isDeafened ? 'Undeafen' : 'Deafen'}>
                <Headphones size={18} />
              </button>
              <button className="voice-tool-btn disconnect" onClick={leaveVoice} title="Disconnect">
                <PhoneOff size={18} />
              </button>
            </div>
            <div className="voice-ping-info">
              {ping !== null && (
                <button className="voice-tool-btn ping-btn" onClick={() => setShowDetails(true)} title="Connection Details">
                  <SignalBars ping={ping} />
                  <span className="ping-text">{ping} ms</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {showDetails && <ConnectionDetailsModal onClose={() => setShowDetails(false)} />}
    </div>
  )
}
