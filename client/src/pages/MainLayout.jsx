import { useState, useEffect } from 'react'
import { useAuth, useAvatarColor } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useVoice } from '../contexts/VoiceContext'
import { nicknameToColor } from '../utils'
import ChannelList from '../components/ChannelList'
import Chat from '../components/Chat'
import VoiceChannel from '../components/VoiceChannel'
import UserList from '../components/UserList'
import SettingsModal from '../components/SettingsModal'
import UserProfilePopup from '../components/UserProfilePopup'

export default function MainLayout() {
  const { nickname, logout } = useAuth()
  const socket = useSocket()
  const { joined, voiceChannel, leaveVoice } = useVoice()
  const avatarColor = useAvatarColor()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [users, setUsers] = useState([])
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userPopup, setUserPopup] = useState(null)

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
        />

        <div className="sidebar-footer">
          <div className="user-info" onClick={(e) => setUserPopup({ user: nickname, x: e.clientX + 10, y: e.clientY - 200 })}>
            <div className="user-avatar" style={{ background: avatarColor }}>{nickname[0]?.toUpperCase()}</div>
            <span className="user-name">{nickname}</span>
          </div>
          <div className="footer-actions">
            {joined && (
              <button className="footer-btn disconnect" onClick={leaveVoice} title="Disconnect Voice">
                📞
              </button>
            )}
            <button className="footer-btn" onClick={() => setShowSettings(true)} title="User Settings">
              ⚙
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {!activeChannel ? (
          <div className="welcome">
            <div className="mobile-toggle" onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
              &#9776;
            </div>
            <h2>Welcome to Medium</h2>
            <p>Pick a channel to start talking</p>
          </div>
        ) : activeChannel.type === 'text' ? (
          <Chat key={activeChannel.id} channel={activeChannel} onUserClick={setUserPopup} />
        ) : (
          <VoiceChannel key={activeChannel.id} channel={activeChannel} onUserClick={setUserPopup} />
        )}
      </main>

      <aside className="user-panel">
        <h3 className="panel-header">Members — {users.length}</h3>
        <UserList users={users} onUserClick={setUserPopup} />
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
    </div>
  )
}
