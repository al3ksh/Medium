import { useState, useEffect, useCallback, useRef } from 'react'
import { PhoneOff, Settings, Menu, Mic, MicOff, Headphones, Search } from 'lucide-react'
import { useAuth, useAvatarColor, useUserAvatar } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useVoice } from '../contexts/VoiceContext'
import { nicknameToColor, useAnimatedClose } from '../utils'
import { showToast } from '../components/ToastContainer'
import { playNotifSound } from '../utils/notif'
import { isChannelMuted, getNotifSetting } from '../components/ChannelContextMenu'
import ChannelList from '../components/ChannelList'
import Chat from '../components/Chat'
import VoiceChannel from '../components/VoiceChannel'
import UserList from '../components/UserList'
import SettingsModal from '../components/SettingsModal'
import UserProfilePopup from '../components/UserProfilePopup'
import UserContextMenu from '../components/UserContextMenu'
import ChannelContextMenu from '../components/ChannelContextMenu'
import ConfirmModal from '../components/ConfirmModal'
import CreateChannelModal from '../components/CreateChannelModal'
import SearchModal from '../components/SearchModal'
import ConnectionDetailsModal from '../components/ConnectionDetailsModal'

export default function MainLayout() {
  const { nickname, logout } = useAuth()
  const socket = useSocket()
  const { joined, voiceChannel, leaveVoice, joinVoice, setUserVolume, toggleUserMute, isUserMuted, getUserVolume, isMuted, isDeafened, toggleMute, toggleDeafen, ping, occupancy } = useVoice()
  const avatarColor = useAvatarColor()
  const getAvatar = useUserAvatar()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannelRaw] = useState(null)

  function setActiveChannel(ch) {
    setActiveChannelRaw(ch)
    activeChannelRef.current = ch
    if (ch) {
      localStorage.setItem('active-channel', JSON.stringify({ id: ch.id, name: ch.name, type: ch.type }))
    } else {
      localStorage.removeItem('active-channel')
    }
  }
  const [users, setUsers] = useState([])
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userPopup, setUserPopup] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [channelContextMenu, setChannelContextMenu] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [createModal, setCreateModal] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const activeChannelRef = useRef(null)
  const channelsRef = useRef(channels)

  useEffect(() => { channelsRef.current = channels }, [channels])
  const [unlockedChannels, setUnlockedChannels] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('unlocked-channels') || '[]')) } catch { return new Set() }
  })
  const [unlockModal, setUnlockModal] = useState(null)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unread, setUnread] = useState({})
  const [showConnectionDetails, setShowConnectionDetails] = useState(false)

  function clearUnread(channelId) {
    setUnread(prev => {
      if (!prev[channelId]) return prev
      const next = { ...prev }
      delete next[channelId]
      return next
    })
  }

  useEffect(() => {
    fetch('/api/channels', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then((chs) => {
        setChannels(chs)
        try {
          const saved = JSON.parse(localStorage.getItem('active-channel'))
          if (saved?.id && chs.some(c => c.id === saved.id)) {
            setActiveChannelRaw(chs.find(c => c.id === saved.id))
          }
        } catch {}
      })

    socket.on('channel:created', (channel) => {
      setChannels((prev) => [...prev, channel])
    })

    socket.on('channel:deleted', (channelId) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
      setActiveChannelRaw((prev) => prev?.id === channelId ? null : prev)
      localStorage.removeItem('active-channel')
    })

    socket.on('channel:renamed', (updated) => {
      setChannels((prev) => prev.map((c) => c.id === updated.id ? { ...c, name: updated.name } : c))
      setActiveChannelRaw((prev) => prev?.id === updated.id ? { ...prev, name: updated.name } : prev)
    })

    socket.on('users:update', setUsers)

    socket.on('message:unread', ({ channel_id }) => {
      if (channel_id !== activeChannelRef.current?.id) {
        setUnread((prev) => ({ ...prev, [channel_id]: (prev[channel_id] || 0) + 1 }))
      }
    })

    socket.on('message:mention', (msg) => {
      const ch = channelsRef.current?.find(c => c.id === msg.channel_id)
      if (!ch) return
      const isEveryone = msg.content.includes('@everyone') || msg.content.includes('@here')
      const escaped = nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const isMentioned = new RegExp(`@${escaped}(?=\\s|$|[^\\w])`, 'i').test(msg.content)
      const notifSetting = getNotifSetting(ch.id)
      const muted = isChannelMuted(ch.id)

      if (muted || notifSetting === 'none') return
      if (notifSetting === 'mentions' && !isMentioned && !isEveryone) return
      if (notifSetting === 'default' && !isEveryone && !isMentioned) return

      if (isEveryone || isMentioned) {
        playNotifSound()
        const label = isEveryone ? (msg.content.includes('@everyone') ? '@everyone' : '@here') : `@${nickname}`
        showToast(`${msg.nickname} mentioned you (${label}) in #${ch.name}`)
      }
    })

    return () => {
      socket.off('channel:created')
      socket.off('channel:deleted')
      socket.off('channel:renamed')
      socket.off('users:update')
      socket.off('message:unread')
      socket.off('message:mention')
    }
  }, [])

  useEffect(() => {
    function handleGlobalKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(v => !v)
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [])

  const handleContextMenu = useCallback((e, user) => {
    e.preventDefault()
    setContextMenu({
      user,
      x: e.clientX,
      y: e.clientY,
    })
  }, [])

  const handleVolumeChange = useCallback((user, vol) => {
    setUserVolume(user, vol)
    setContextMenu((prev) => prev ? { ...prev, volume: vol } : null)
  }, [setUserVolume])

  const handleMuteToggle = useCallback((user) => {
    toggleUserMute(user)
  }, [toggleUserMute])

  const handleChannelContextMenu = useCallback((e, channel) => {
    e.preventDefault()
    setChannelContextMenu({ channel, x: e.clientX, y: e.clientY })
  }, [])

  const handleChannelDelete = useCallback(async (channel) => {
    setConfirmModal({
      title: 'Delete Channel',
      message: `Are you sure you want to delete #${channel.name}? This cannot be undone.`,
      confirmLabel: 'Delete Channel',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/channels/${channel.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
        if (res.ok) {
          socket.emit('channel:deleted', channel.id)
          setChannels((prev) => prev.filter((c) => c.id !== channel.id))
          if (activeChannel?.id === channel.id) setActiveChannel(null)
        }
        setConfirmModal(null)
      },
    })
  }, [socket, activeChannel])

  const handleChannelEdit = useCallback(async (channelId, newName) => {
    const res = await fetch(`/api/channels/${channelId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name: newName }),
    })
    if (res.ok) {
      const updated = await res.json()
      socket.emit('channel:renamed', updated)
      setChannels((prev) => prev.map((c) => c.id === updated.id ? updated : c))
      if (activeChannel?.id === updated.id) setActiveChannel(updated)
    }
  }, [socket, activeChannel])

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  function handleUnlock(channel) {
    setUnlockModal(channel)
    setUnlockPassword('')
    setUnlockError('')
  }

  function submitUnlock() {
    socket.emit('channel:unlock', unlockPassword, (res) => {
      if (res?.ok) {
        const newSet = new Set(unlockedChannels)
        channels.filter(c => c.locked).forEach(c => newSet.add(c.id))
        setUnlockedChannels(newSet)
        localStorage.setItem('unlocked-channels', JSON.stringify([...newSet]))
        setUnlockModal(null)
        setActiveChannel(unlockModal)
        setShowMobileSidebar(false)
      } else {
        setUnlockError(res?.error || 'Wrong password')
      }
    })
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${showMobileSidebar ? 'mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ gap: '0.6rem' }}>
          <img src="/logo 11.png" alt="" style={{ height: '28px', objectFit: 'contain' }} />
          <h2 style={{ fontSize: '1.25rem' }}>Medium</h2>
          <button className="footer-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowSearch(true)} title="Search">
            <Search size={16} />
          </button>
        </div>

        <ChannelList
          label="TEXT CHANNELS"
          channels={textChannels}
          activeId={activeChannel?.id}
          onSelect={(ch) => {
            setActiveChannel(ch)
            clearUnread(ch.id)
            setShowMobileSidebar(false)
          }}
          type="text"
          socket={socket}
          onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
          onChannelDeleted={(id) => {
            setChannels((prev) => prev.filter((c) => c.id !== id))
            if (activeChannel?.id === id) setActiveChannel(null)
          }}
          onChannelContextMenu={handleChannelContextMenu}
          onRequestCreate={() => {}}
          unlockedChannels={unlockedChannels}
          onUnlockNeeded={handleUnlock}
          unread={unread}
        />

        <ChannelList
          label="VOICE CHANNELS"
          channels={voiceChannels}
          activeId={activeChannel?.id}
          onSelect={(ch) => {
            setActiveChannel(ch)
            clearUnread(ch.id)
            setShowMobileSidebar(false)
          }}
          type="voice"
          socket={socket}
          onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
          onChannelDeleted={(id) => {
            setChannels((prev) => prev.filter((c) => c.id !== id))
            if (activeChannel?.id === id) setActiveChannel(null)
          }}
          onChannelContextMenu={handleChannelContextMenu}
          onUserClick={setUserPopup}
          onUserContextMenu={handleContextMenu}
          onRequestCreate={() => {}}
          unlockedChannels={unlockedChannels}
          onUnlockNeeded={handleUnlock}
        />

        <div className="sidebar-footer">
          <div className="user-info" onClick={(e) => setUserPopup({ user: nickname, x: e.clientX + 10, y: e.clientY - 200 })}>
            <div className="user-avatar" style={getAvatar(nickname) ? {} : { background: avatarColor }}>
              {getAvatar(nickname) ? <img src={getAvatar(nickname)} alt="" /> : nickname[0]?.toUpperCase()}
            </div>
            <span className="user-name">{nickname}</span>
          </div>
          <div className="footer-actions">
            {joined && (
              <>
                <button className={`footer-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button className={`footer-btn deafen ${isDeafened ? 'active' : ''}`} onClick={toggleDeafen} title={isDeafened ? 'Undeafen' : 'Deafen'}>
                  <Headphones size={16} />
                </button>
                <button className="footer-btn disconnect" onClick={leaveVoice} title="Disconnect Voice">
                  <PhoneOff size={16} />
                </button>
                {ping !== null && (
                  <button className="footer-btn" onClick={() => setShowConnectionDetails(true)} title="Connection Details" style={{ width: 'auto', padding: '0 6px', gap: '4px' }}>
                    <div className="signal-bars" data-quality={ping <= 70 ? '4' : ping <= 150 ? '3' : ping <= 300 ? '2' : '1'}>
                      {[1, 2, 3, 4].map((level) => (
                        <div key={level} className={`signal-bar ${ping <= (level === 1 ? 300 : level === 2 ? 150 : level === 3 ? 70 : 0) ? 'active' : ''}`} style={{ height: `${3 + level * 3}px` }} />
                      ))}
                    </div>
                  </button>
                )}
              </>
            )}
            <button className="footer-btn" onClick={() => setShowSettings(true)} title="User Settings">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {!activeChannel ? (
          <div className="welcome">
            <div className="mobile-toggle" onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
              <Menu size={20} />
            </div>
            <img src="/logo 11.png" alt="Medium" style={{ height: '72px', marginBottom: '1.5rem', objectFit: 'contain', opacity: 0.9 }} />
            <p>Pick a channel to start talking</p>
          </div>
        ) : activeChannel.type === 'text' ? (
          <Chat key={activeChannel.id} channel={activeChannel} users={users} nickname={nickname} onUserClick={setUserPopup} onUserContextMenu={handleContextMenu} />
        ) : (
          <VoiceChannel key={activeChannel.id} channel={activeChannel} onUserClick={setUserPopup} onUserContextMenu={handleContextMenu} />
        )}
      </main>

      <aside className="user-panel">
        <h3 className="panel-header">Members — {users.length}</h3>
        <UserList users={users} onUserClick={setUserPopup} onUserContextMenu={handleContextMenu} />
      </aside>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {userPopup && (
        <UserProfilePopup
          user={userPopup.user}
          x={userPopup.x}
          y={userPopup.y}
          onClose={() => setUserPopup(null)}
        />
      )}
      {contextMenu && (
        <UserContextMenu
          user={contextMenu.user}
          x={contextMenu.x}
          y={contextMenu.y}
          nickname={nickname}
          volume={contextMenu.volume ?? getUserVolume(contextMenu.user)}
          isMuted={isUserMuted(contextMenu.user)}
          voiceChannelOfUser={(() => {
            for (const [chId, users] of Object.entries(occupancy)) {
              if (users.includes(contextMenu.user)) {
                const ch = channels.find(c => c.id === chId)
                return ch ? { id: chId, name: ch.name } : null
              }
            }
            return null
          })()}
          onProfile={(user) => setUserPopup({ user, x: contextMenu.x + 10, y: contextMenu.y - 200 })}
          onMuteToggle={handleMuteToggle}
          onVolumeChange={handleVolumeChange}
          onKickFromVoice={(nickname) => {
            for (const [chId, users] of Object.entries(occupancy)) {
              if (users.includes(nickname)) {
                socket?.emit('voice:kick', { nickname, channelId: chId })
                break
              }
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {channelContextMenu && (
        <ChannelContextMenu
          channel={channelContextMenu.channel}
          x={channelContextMenu.x}
          y={channelContextMenu.y}
          occupancy={occupancy}
          onOpen={(ch) => { setActiveChannel(ch); setShowMobileSidebar(false) }}
          onJoinVoice={joinVoice}
          onEdit={handleChannelEdit}
          onCreate={() => {
            setCreateModal({ type: channelContextMenu.channel.type })
          }}
          onDelete={handleChannelDelete}
          onClose={() => setChannelContextMenu(null)}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {createModal && (
        <CreateChannelModal
          type={createModal.type}
          onConfirm={async (name) => {
            const res = await fetch('/api/channels', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({ name, type: createModal.type }),
            })
            if (res.ok) {
              const ch = await res.json()
              socket.emit('channel:created', ch)
              setChannels((prev) => [...prev, ch])
            }
            setCreateModal(null)
          }}
          onCancel={() => setCreateModal(null)}
        />
      )}
      {unlockModal && (
        <UnlockModal
          channel={unlockModal}
          password={unlockPassword}
          setPassword={setUnlockPassword}
          error={unlockError}
          onSubmit={submitUnlock}
          onCancel={() => setUnlockModal(null)}
        />
      )}
      {showSearch && (
        <SearchModal
          channels={channels}
          nickname={nickname}
          onClose={(msg) => {
            setShowSearch(false)
            if (msg?.channel_id) {
              const ch = channels.find(c => c.id === msg.channel_id)
              if (ch) setActiveChannel(ch)
            }
          }}
        />
      )}
      {showConnectionDetails && <ConnectionDetailsModal onClose={() => setShowConnectionDetails(false)} />}
    </div>
  )
}

function UnlockModal({ channel, password, setPassword, error, onSubmit, onCancel }) {
  const { closing, animatedClose } = useAnimatedClose(onCancel)
  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={animatedClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '0.5rem' }}>Locked Channel</h2>
        <p className="confirm-modal-message" style={{ marginBottom: '1.25rem' }}>
          #{channel.name} requires a password to access
        </p>
        <input
          type="password"
          placeholder="Channel password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && password) onSubmit(); if (e.key === 'Escape') animatedClose() }}
          style={{
            width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            fontSize: '1rem', outline: 'none', marginBottom: '1rem', boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}
        <div className="confirm-modal-actions">
          <button className="confirm-btn cancel" onClick={animatedClose}>Cancel</button>
          <button className="confirm-btn primary" disabled={!password} onClick={onSubmit}>Unlock</button>
        </div>
      </div>
    </div>
  )
}
