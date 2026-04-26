import { useState, useEffect, useCallback } from 'react'
import { PhoneOff, Settings, Menu, Mic, MicOff, Headphones } from 'lucide-react'
import { useAuth, useAvatarColor, useUserAvatar } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useVoice } from '../contexts/VoiceContext'
import { nicknameToColor } from '../utils'
import ChannelList from '../components/ChannelList'
import Chat from '../components/Chat'
import VoiceChannel from '../components/VoiceChannel'
import UserList from '../components/UserList'
import SettingsModal from '../components/SettingsModal'
import UserProfilePopup from '../components/UserProfilePopup'
import UserContextMenu from '../components/UserContextMenu'

export default function MainLayout() {
  const { nickname, logout } = useAuth()
  const socket = useSocket()
  const { joined, voiceChannel, leaveVoice, setUserVolume, toggleUserMute, isUserMuted, getUserVolume, isMuted, isDeafened, toggleMute, toggleDeafen, ping } = useVoice()
  const avatarColor = useAvatarColor()
  const getAvatar = useUserAvatar()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [users, setUsers] = useState([])
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userPopup, setUserPopup] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => {
    fetch('/api/channels', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setChannels)

    socket.on('channel:created', (channel) => {
      setChannels((prev) => [...prev, channel])
    })

    socket.on('channel:deleted', (channelId) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
      if (activeChannel?.id === channelId) setActiveChannel(null)
    })

    socket.on('users:update', setUsers)

    return () => {
      socket.off('channel:created')
      socket.off('channel:deleted')
      socket.off('users:update')
    }
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

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  return (
    <div className="app-layout">
      <aside className={`sidebar ${showMobileSidebar ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h2>Medium</h2>
        </div>

        <ChannelList
          label="TEXT CHANNELS"
          channels={textChannels}
          activeId={activeChannel?.id}
          onSelect={(ch) => {
            setActiveChannel(ch)
            setShowMobileSidebar(false)
          }}
          type="text"
          socket={socket}
          onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
          onChannelDeleted={(id) => {
            setChannels((prev) => prev.filter((c) => c.id !== id))
            if (activeChannel?.id === id) setActiveChannel(null)
          }}
        />

        <ChannelList
          label="VOICE CHANNELS"
          channels={voiceChannels}
          activeId={activeChannel?.id}
          onSelect={(ch) => {
            setActiveChannel(ch)
            setShowMobileSidebar(false)
          }}
          type="voice"
          socket={socket}
          onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
          onChannelDeleted={(id) => {
            setChannels((prev) => prev.filter((c) => c.id !== id))
            if (activeChannel?.id === id) setActiveChannel(null)
          }}
          onUserClick={setUserPopup}
          onUserContextMenu={handleContextMenu}
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
                  <div className="signal-bars" title={`${ping}ms`} data-quality={ping <= 70 ? '4' : ping <= 150 ? '3' : ping <= 300 ? '2' : '1'}>
                    {[1, 2, 3, 4].map((level) => (
                      <div key={level} className={`signal-bar ${ping <= (level === 1 ? 300 : level === 2 ? 150 : level === 3 ? 70 : 0) ? 'active' : ''}`} style={{ height: `${3 + level * 3}px` }} />
                    ))}
                  </div>
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
            <h2>Welcome to Medium</h2>
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
          volume={contextMenu.volume ?? getUserVolume(contextMenu.user)}
          isMuted={isUserMuted(contextMenu.user)}
          onProfile={(user) => setUserPopup({ user, x: contextMenu.x + 10, y: contextMenu.y - 200 })}
          onMuteToggle={handleMuteToggle}
          onVolumeChange={handleVolumeChange}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
