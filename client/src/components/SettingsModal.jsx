import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useVoice } from '../contexts/VoiceContext'
import { useSocket } from '../contexts/SocketContext'
import { nicknameToColor, loadSettings, saveSettings, THEMES, THEME_VARS, applyTheme } from '../utils'
import { X, LogOut, Check, Palette } from 'lucide-react'

// Custom tooltip slider mimicking Discord
function TooltipSlider({ value, min, max, onChange, suffix = '%', disabled = false, trackStyle = {} }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const percent = ((value - min) / (max - min)) * 100;
  
  return (
    <div 
      className="tooltip-slider-container"
      onMouseEnter={() => !disabled && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        onMouseDown={() => !disabled && setShowTooltip(true)}
        onMouseUp={() => setShowTooltip(false)}
        onTouchStart={() => !disabled && setShowTooltip(true)}
        onTouchEnd={() => setShowTooltip(false)}
        className={`discord-slider ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        style={trackStyle}
      />
      {showTooltip && (
        <div className="slider-tooltip" style={{ left: `calc(${percent}% + ${10 - percent * 0.2}px)` }}>
          <div className="slider-tooltip-tail"></div>
          {value}{suffix}
        </div>
      )}
    </div>
  );
}

// Discord-like switch
function CheckboxSwitch({ checked, onChange }) {
  return (
    <div className={`discord-switch ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}>
      <div className="discord-switch-handle">
        {checked && <Check size={12} className="discord-switch-icon" />}
      </div>
    </div>
  )
}

function AppearanceTab({ settings, onUpdate }) {
  const currentTheme = settings.theme || 'dark'
  const customTheme = settings.customTheme || { ...THEMES.dark.vars }

  function selectTheme(name) {
    const patch = { theme: name }
    if (name === 'custom' && !settings.customTheme) {
      patch.customTheme = { ...THEMES.dark.vars }
    }
    onUpdate(patch)
    applyTheme(name, patch.customTheme || settings.customTheme)
  }

  function updateCustomVar(key, value) {
    const next = { ...settings.customTheme, [key]: value }
    onUpdate({ theme: 'custom', customTheme: next })
    applyTheme('custom', next)
  }

  return (
    <div className="settings-section">
      <h3>Theme</h3>
      <div className="theme-grid">
        {Object.entries(THEMES).map(([id, theme]) => (
          <button
            key={id}
            className={`theme-card ${currentTheme === id ? 'active' : ''}`}
            onClick={() => selectTheme(id)}
          >
            <div className="theme-preview" style={{
              background: theme.vars['--bg-primary'],
              borderColor: theme.vars['--border'],
            }}>
              <div className="theme-preview-sidebar" style={{ background: theme.vars['--bg-tertiary'] }} />
              <div className="theme-preview-content" style={{ background: theme.vars['--bg-primary'] }}>
                <div style={{ background: theme.vars['--accent'], width: '60%', height: '4px', borderRadius: '2px' }} />
                <div style={{ background: theme.vars['--text-muted'], width: '80%', height: '3px', borderRadius: '2px' }} />
              </div>
            </div>
            <span>{theme.label}</span>
          </button>
        ))}
        <button
          className={`theme-card ${currentTheme === 'custom' ? 'active' : ''}`}
          onClick={() => selectTheme('custom')}
        >
          <div className="theme-preview" style={{ borderColor: 'var(--border)' }}>
            <Palette size={24} style={{ margin: 'auto', color: 'var(--accent)' }} />
          </div>
          <span>Custom</span>
        </button>
      </div>

      {currentTheme === 'custom' && (
        <div className="theme-editor">
          <h4>Custom Theme Editor</h4>
          <div className="theme-editor-grid">
            {THEME_VARS.map(({ key, label }) => (
              <div key={key} className="theme-color-row">
                <input
                  type="color"
                  value={customTheme[key] || '#000000'}
                  onChange={(e) => updateCustomVar(key, e.target.value)}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'account', label: 'My Account' },
  { id: 'appearance', label: 'Appearance' },
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
          {tab === 'appearance' && <AppearanceTab settings={settings} onUpdate={update} />}
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
  const [isTesting, setIsTesting] = useState(false)
  const audioRefs = useRef(null)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((list) => {
      setDevices(list.filter((d) => d.kind === 'audioinput'))
    })
  }, [])

  useEffect(() => {
    let active = true;

    async function initMic() {
      try {
        const constraints = settings.inputDevice
          ? { deviceId: { exact: settings.inputDevice } }
          : {}
        const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        source.connect(analyser)
        // Analyser not connected to ctx.destination by default
        analyser.fftSize = 256
        
        audioRefs.current = { ctx, stream, source, analyser }
        const data = new Uint8Array(analyser.frequencyBinCount)

        function loop() {
          if (!active) return;
          analyser.getByteFrequencyData(data)
          const avg = data.reduce((a, b) => a + b, 0) / data.length
          setTestVolume(Math.min(avg / 128 * 100, 100))
          requestAnimationFrame(loop)
        }
        loop()
      } catch (err) {
        console.error("Mic access denied or error:", err)
      }
    }
    
    initMic()

    return () => {
      active = false;
      const refs = audioRefs.current;
      if (refs) {
        if (refs.stream) refs.stream.getTracks().forEach((t) => t.stop())
        if (refs.ctx) refs.ctx.close()
      }
      audioRefs.current = null;
    }
  }, [settings.inputDevice])

  function testMic() {
    const refs = audioRefs.current;
    if (!refs) return;
    
    if (isTesting) {
      refs.analyser.disconnect(refs.ctx.destination);
      setIsTesting(false);
    } else {
      refs.analyser.connect(refs.ctx.destination);
      setIsTesting(true);
    }
  }

  return (
    <div className="settings-section">
      <h3>Voice & Audio</h3>

      <div className="settings-discord-grid">
        <div className="settings-group">
          <label>Input Device</label>
          <select
            value={settings.inputDevice || ''}
            onChange={(e) => onUpdate({ inputDevice: e.target.value })}
          >
            <option value="">Default (All devices)</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${devices.indexOf(d) + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-group">
          <label>Output Device</label>
          <select disabled>
            <option>Default (Speakers)</option>
          </select>
        </div>

        <div className="settings-group">
          <label>Input Volume</label>
          <div className="range-row">
            <TooltipSlider min={0} max={200} value={settings.inputVolume ?? 100} onChange={(val) => onUpdate({ inputVolume: val })} />
          </div>
        </div>

        <div className="settings-group">
          <label>Output Volume</label>
          <div className="range-row">
            <TooltipSlider min={0} max={200} value={settings.outputVolume ?? 100} onChange={(val) => onUpdate({ outputVolume: val })} />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="discord-mic-test-row">
          <button className="discord-test-btn" onClick={testMic}>
            {isTesting ? 'Stop testing' : 'Let\'s Check'}
          </button>
          <div className="discord-meter">
            {Array.from({ length: 40 }).map((_, i) => {
              const active = isTesting && (testVolume / 100) * 40 > i;
              const colorClass = i > 35 ? 'red' : i > 28 ? 'yellow' : '';
              return (
                <div key={i} className={`discord-meter-bar ${active ? 'active' : ''} ${active && colorClass ? colorClass : ''}`} />
              )
            })}
          </div>
        </div>
      </div>

      <div className="settings-group" style={{ marginTop: '2rem' }}>
        <h3>Input Mode</h3>
        <div className="voice-mode-options">
          <label className="voice-mode-radio">
            <input 
              type="radio" 
              name="voiceMode" 
              value="studio" 
              checked={settings.voiceMode === 'studio'} 
              onChange={() => onUpdate({ voiceMode: 'studio' })} 
            />
            <div className="radio-circle"></div>
            <div className="radio-text">
              <div className="radio-title">Studio</div>
              <div className="radio-desc">Clear audio: open microphone without processing</div>
            </div>
          </label>
          <label className="voice-mode-radio">
            <input 
              type="radio" 
              name="voiceMode" 
              value="custom" 
              checked={settings.voiceMode !== 'studio'} 
              onChange={() => onUpdate({ voiceMode: 'custom' })} 
            />
            <div className="radio-circle"></div>
            <div className="radio-text">
              <div className="radio-title">Custom</div>
              <div className="radio-desc">Advanced mode: give me all the buttons and dials!</div>
            </div>
          </label>
        </div>

        {settings.voiceMode !== 'studio' && (
          <div className="sensitivity-section">
            <div className="sensitivity-toggle-row">
              <div className="sensitivity-toggle-text">
                <div className="sensitivity-toggle-title">Automatically determine input sensitivity</div>
                <div className="sensitivity-toggle-desc">Determines how much sound the application transmits from your microphone.</div>
              </div>
              <CheckboxSwitch 
                checked={settings.autoInputSensitivity ?? false}
                onChange={(val) => onUpdate({ autoInputSensitivity: val })}
              />
            </div>
            
            <div className="threshold-slider-wrapper">
              <div className="threshold-track-bg" />
              <div 
                className={`threshold-bg ${settings.autoInputSensitivity ? 'disabled' : ''}`}
                style={{ 
                  background: `linear-gradient(to right, var(--yellow) ${settings.inputSensitivity ?? 50}%, var(--green) ${settings.inputSensitivity ?? 50}%)`,
                  clipPath: settings.autoInputSensitivity ? 'none' : `inset(0 ${100 - (testVolume * 1.5)}% 0 0)`, /* scaled slightly so it reaches end more predictably */
                  transition: 'clip-path 0.1s linear'
                }} 
              />
              <TooltipSlider 
                min={0} 
                max={100} 
                value={settings.inputSensitivity ?? 50} 
                onChange={(val) => onUpdate({ inputSensitivity: val })} 
                suffix="%"
                disabled={settings.autoInputSensitivity ?? false}
              />
            </div>
          </div>
        )}
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
