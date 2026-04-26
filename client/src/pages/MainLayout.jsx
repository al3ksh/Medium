import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import ChannelList from '../components/ChannelList'
import Chat from '../components/Chat'
import VoiceChannel from '../components/VoiceChannel'
import UserList from '../components/UserList'

export default function MainLayout() {
  const { nickname, logout } = useAuth()
  const socket = useSocket()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [users, setUsers] = useState([])
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

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
        />

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{nickname[0]?.toUpperCase()}</div>
            <span className="user-name">{nickname}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Logout">
            &#x2715;
          </button>
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
          <Chat key={activeChannel.id} channel={activeChannel} />
        ) : (
          <VoiceChannel key={activeChannel.id} channel={activeChannel} />
        )}
      </main>

      <aside className="user-panel">
        <h3 className="panel-header">Members — {users.length}</h3>
        <UserList users={users} />
      </aside>
    </div>
  )
}
