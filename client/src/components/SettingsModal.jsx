import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useVoice } from '../contexts/VoiceContext'
import { useSocket } from '../contexts/SocketContext'
import { nicknameToColor, loadSettings, saveSettings } from '../utils'
import { X, LogOut } from 'lucide-react'

const TABS = [
  { id: 'account', label: 'My Account' },
  { id: 'voice', label: 'Voice & Audio' },
  { id: 'notifications', label: 'Notifications' },
]

export default function SettingsModal({ onClose }) {
  const { logout } = useAuth()
  const voice = useVoice()
  const [tab, setTab] = useState('account')
  const [settings, setSettings] = useState(loadSettings)

  function update(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-modal">
        <div className="settings-sidebar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`settings-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="settings-sidebar-sep" />
          <button className="settings-tab logout" onClick={() => { onClose(); logout() }}>
            <LogOut size={16} /> Log Out
          </button>
        </div>

        <div className="settings-content">
          <button className="settings-close" onClick={onClose}><X size={20} /></button>

          {tab === 'account' && <AccountTab settings={settings} onUpdate={update} />}
          {tab === 'voice' && <VoiceTab settings={settings} onUpdate={update} voice={voice} />}
          {tab === 'notifications' && <NotificationsTab settings={settings} onUpdate={update} />}
        </div>
      </div>
    </div>
  )
}

function AccountTab({ settings, onUpdate }) {
  const { nickname, avatarColor, updateAvatarColor, userBios } = useAuth()
  const socket = useSocket()
  const color = avatarColor || nicknameToColor(nickname)
  const currentBio = userBios?.[nickname] || ''

  function handleBioChange(e) {
    const bio = e.target.value.slice(0, 190)
    socket.emit('user:bio', bio)
  }

  return (
    <div className="settings-section">
      <h3>My Account</h3>
      <div className="account-card">
        <div className="account-banner" style={{ background: color }} />
        <div className="account-info">
          <div className="account-avatar" style={{ background: color }}>
            {nickname[0]?.toUpperCase()}
          </div>
          <div className="account-details">
            <span className="account-name">{nickname}</span>
            <span className="account-tag">@{nickname.toLowerCase().replace(/\s/g, '-')}</span>
      </div>

      <div className="settings-group">
        <label>About Me</label>
        <textarea
          className="bio-input"
          rows={3}
          maxLength={190}
          placeholder="Tell others something about yourself..."
          defaultValue={currentBio}
          onBlur={handleBioChange}
        />
      </div>
    </div>
      </div>

      <div className="settings-group">
        <label>Accent Color</label>
        <div className="color-picker">
          {['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
            '#f47b67', '#e8a23e', '#3ba55c', '#0d7dcd', '#9b59b6',
            '#e91e63', '#00bcd4', '#ff9800', '#795548', '#ffffff'].map((c) => (
            <button
              key={c}
              className={`color-swatch ${color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => {
                onUpdate({ avatarColor: c })
                updateAvatarColor(c)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function VoiceTab({ settings, onUpdate, voice }) {
  const [devices, setDevices] = useState([])
  const [testVolume, setTestVolume] = useState(0)
  const testRef = useRef(null)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((list) => {
      setDevices(list.filter((d) => d.kind === 'audioinput'))
    })
  }, [])

  async function testMic() {
    try {
      const constraints = settings.inputDevice
        ? { deviceId: { exact: settings.inputDevice } }
        : {}
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      source.connect(analyser)
      analyser.fftSize = 256
      const data = new Uint8Array(analyser.frequencyBinCount)

      function loop() {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setTestVolume(Math.min(avg / 128 * 100, 100))
        if (testRef.current) requestAnimationFrame(loop)
      }
      testRef.current = true
      loop()

      setTimeout(() => {
        testRef.current = false
        stream.getTracks().forEach((t) => t.stop())
        ctx.close()
        setTestVolume(0)
      }, 5000)
    } catch {}
  }

  return (
    <div className="settings-section">
      <h3>Voice & Audio</h3>

      <div className="settings-group">
        <label>Input Device</label>
        <select
          value={settings.inputDevice || ''}
          onChange={(e) => onUpdate({ inputDevice: e.target.value })}
        >
          <option value="">Default</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${devices.indexOf(d) + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-group">
        <label>Input Volume</label>
        <div className="range-row">
          <input type="range" min="0" max="200" value={settings.inputVolume ?? 100} onChange={(e) => onUpdate({ inputVolume: parseInt(e.target.value) })} />
          <span className="range-value">{settings.inputVolume ?? 100}%</span>
        </div>
      </div>

      <div className="settings-group">
        <label>Output Volume</label>
        <div className="range-row">
          <input type="range" min="0" max="200" value={settings.outputVolume ?? 100} onChange={(e) => onUpdate({ outputVolume: parseInt(e.target.value) })} />
          <span className="range-value">{settings.outputVolume ?? 100}%</span>
        </div>
      </div>

      <div className="settings-group">
        <label>Input Sensitivity</label>
        <div className="range-row">
          <input type="range" min="1" max="100" value={settings.inputSensitivity ?? 10} onChange={(e) => onUpdate({ inputSensitivity: parseInt(e.target.value) })} />
          <span className="range-value">{settings.inputSensitivity ?? 10}</span>
        </div>
      </div>

      <div className="settings-group">
        <button className="test-mic-btn" onClick={testMic}>
          Test Microphone (5s)
        </button>
        <div className="volume-meter">
          <div className="volume-meter-fill" style={{ width: `${testVolume}%` }} />
        </div>
      </div>
    </div>
  )
}

function NotificationsTab({ settings, onUpdate }) {
  return (
    <div className="settings-section">
      <h3>Notifications</h3>

      <div className="settings-group">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.messageSound ?? true}
            onChange={(e) => onUpdate({ messageSound: e.target.checked })}
          />
          Message Sound
        </label>
      </div>

      <div className="settings-group">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.voiceJoinSound ?? true}
            onChange={(e) => onUpdate({ voiceJoinSound: e.target.checked })}
          />
          Voice Channel Join/Leave Sound
        </label>
      </div>

      <div className="settings-group">
        <label>Message Sound Volume</label>
        <div className="range-row">
          <input type="range" min="0" max="100" value={settings.soundVolume ?? 80} onChange={(e) => onUpdate({ soundVolume: parseInt(e.target.value) })} />
          <span className="range-value">{settings.soundVolume ?? 80}%</span>
        </div>
      </div>
    </div>
  )
}
