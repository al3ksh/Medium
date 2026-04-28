import { useState } from 'react'
import { useVoice } from '../contexts/VoiceContext'
import { useAvatarColor, useUserColor, useUserAvatar } from '../contexts/AuthContext'
import { nicknameToColor } from '../utils'
import { Volume2, Mic, MicOff, Headphones, PhoneOff, Radio } from 'lucide-react'
import ConnectionDetailsModal from './ConnectionDetailsModal'

export function SignalBars({ ping }) {
  const quality = ping <= 40 ? '4' : ping <= 70 ? '3' : ping <= 150 ? '2' : '1'
  const activeBars = ping <= 40 ? 4 : ping <= 70 ? 3 : ping <= 150 ? 2 : 1
  return (
    <div className="signal-bars" title={`${ping}ms`} data-quality={quality}>
      {[1, 2, 3, 4].map((level) => (
        <div key={level} className={`signal-bar ${level <= activeBars ? 'active' : ''}`} style={{ height: `${3 + level * 3}px` }} />
      ))}
    </div>
  )
}

export default function VoiceChannel({ channel, onUserClick, onUserContextMenu }) {
  const { joined, voiceChannel, peers, speaking, peerMuted, peerDeafened, joinVoice, leaveVoice, nickname, socketId, isMuted, isDeafened, toggleMute, toggleDeafen, ping, occupancy, voiceStates } = useVoice()
  const selfColor = useAvatarColor()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const isActive = joined && voiceChannel?.id === channel.id
  const [showDetails, setShowDetails] = useState(false)
  const channelUsers = occupancy[channel.id] || []
  const hasUsers = channelUsers.length > 0

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
              onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, nickname) }}
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
                  {peerMuted[p.socketId] && !peerDeafened[p.socketId] && <MicOff size={16} className="voice-status-icon-inline" />}
                  {peerDeafened[p.socketId] && <Headphones size={16} className="voice-status-icon-inline deafened" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isActive && (
          <div className="voice-idle-hero">
            <div className="voice-idle-icon-ring">
              <Radio size={40} className="voice-idle-icon" />
            </div>
            <h2 className="voice-idle-title">{channel.name}</h2>
            {hasUsers ? (
              <>
                <div className="voice-grid-channel">
                  {channelUsers.map((name, i) => {
                    const st = voiceStates[name]
                    return (
                      <div
                        key={`${name}-${i}`}
                        className="voice-peer-observer clickable"
                        onClick={(e) => onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 })}
                        onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, name) }}
                      >
                        <div className="voice-avatar-sm" style={getAvatar(name) ? {} : { background: getColor(name) }}>
                          {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
                        </div>
                        <span className="voice-name-sm">{name}</span>
                        {st?.muted && !st?.deafened && <MicOff size={14} className="voice-user-status muted" />}
                        {st?.deafened && <Headphones size={14} className="voice-user-status deafened" />}
                      </div>
                    )
                  })}
                </div>
                <button className="voice-join-hero-btn" onClick={() => joinVoice(channel)}>
                  <Volume2 size={18} />
                  <span>Join Voice</span>
                </button>
              </>
            ) : (
              <>
                <p className="voice-idle-subtitle">No one is in this voice channel yet — be the first to join!</p>
                <button className="voice-join-hero-btn" onClick={() => joinVoice(channel)}>
                  <Volume2 size={18} />
                  <span>Join Voice</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="voice-controls">
        {!isActive ? null : (
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
