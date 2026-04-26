import { useVoice } from '../contexts/VoiceContext'
import { useAvatarColor, useUserColor } from '../contexts/AuthContext'
import { nicknameToColor } from '../utils'

export default function VoiceChannel({ channel, onUserClick }) {
  const { joined, voiceChannel, peers, speaking, joinVoice, leaveVoice, nickname, socketId } = useVoice()
  const selfColor = useAvatarColor()
  const getColor = useUserColor()
  const isActive = joined && voiceChannel?.id === channel.id

  return (
    <div className="voice-container">
      <div className="voice-header">
        <span>🔊 {channel.name}</span>
      </div>

      <div className="voice-body">
        {isActive && (
          <div
            className="voice-peer clickable"
            onClick={(e) => onUserClick?.({ user: nickname, x: e.clientX + 10, y: e.clientY - 100 })}
          >
            <div className={`voice-avatar speaking-${speaking[socketId] ? 'active' : 'idle'}`} style={{ background: selfColor }}>
              {nickname[0]?.toUpperCase()}
            </div>
            <span>{nickname} (you)</span>
          </div>
        )}

        {isActive && peers.map((p) => (
          <div
            key={p.socketId}
            className="voice-peer clickable"
            onClick={(e) => onUserClick?.({ user: p.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
          >
            <div className={`voice-avatar speaking-${speaking[p.socketId] ? 'active' : 'idle'}`} style={{ background: getColor(p.nickname) }}>
              {p.nickname[0]?.toUpperCase()}
            </div>
            <span>{p.nickname}</span>
          </div>
        ))}

        {isActive && peers.length === 0 && (
          <p className="voice-empty">You're alone here. Invite someone!</p>
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
          <button className="voice-leave-btn" onClick={leaveVoice}>
            Leave Voice
          </button>
        )}
      </div>
    </div>
  )
}
