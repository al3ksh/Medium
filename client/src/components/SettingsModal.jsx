import { useState, useEffect, useRef } from 'react'
import { useAuth, useUserBio, useUserAvatar, useUserBanner } from '../contexts/AuthContext'
import { useVoice } from '../contexts/VoiceContext'
import { useSocket } from '../contexts/SocketContext'
import { nicknameToColor, loadSettings, saveSettings, THEMES, THEME_VARS, applyTheme, useAnimatedClose } from '../utils'
import { X, LogOut, Check, Palette, Camera, Trash2, User, Paintbrush, Volume2, Bell } from 'lucide-react'
import CropModal from './CropModal'
import ConfirmModal from './ConfirmModal'
import LegalModal from './LegalModal'
import CheckboxSwitch from './CheckboxSwitch'

const MAX_BIO = 190

// Custom tooltip slider
function TooltipSlider({ value, min, max, onChange, suffix = '%', displayValue, disabled = false, trackStyle = {} }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const percent = ((value - min) / (max - min)) * 100;
  const display = displayValue ? displayValue(value) : `${value}${suffix}`;
  
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
        className={`medium-slider ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        style={trackStyle}
      />
      {showTooltip && (
        <div className="slider-tooltip" style={{ left: `calc(${percent}% + ${10 - percent * 0.2}px)` }}>
          <div className="slider-tooltip-tail"></div>
          {display}
        </div>
      )}
    </div>
  );
}

// Toggle switch component
function AppearanceTab({ settings, onUpdate }) {
  const currentTheme = settings.theme || 'amoled'
  const customTheme = settings.customTheme || { ...THEMES.amoled.vars }

  function selectTheme(name) {
    const patch = { theme: name }
    if (name === 'custom' && !settings.customTheme) {
      patch.customTheme = { ...THEMES.amoled.vars }
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
  { id: 'account', label: 'My Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Paintbrush },
  { id: 'voice', label: 'Voice & Audio', icon: Volume2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function SettingsModal({ onClose }) {
  const { logout } = useAuth()
  const voice = useVoice()
  const [tab, setTab] = useState('account')
  const [settings, setSettings] = useState(loadSettings)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [legalType, setLegalType] = useState(null)
  const micTestActive = useRef(false)
  const wasDeafenedBeforeRef = useRef(false)
  const { closing, animatedClose } = useAnimatedClose(onClose)

  function handleClose() {
    if (micTestActive.current && voice.joined && !wasDeafenedBeforeRef.current) {
      voice.toggleDeafen()
    }
    micTestActive.current = false
    animatedClose()
  }

  function update(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    if ('outputDevice' in patch || 'outputVolume' in patch || 'inputDevice' in patch || 'inputVolume' in patch || 'voiceMode' in patch || 'inputSensitivity' in patch || 'autoInputSensitivity' in patch) {
      window.dispatchEvent(new Event('settings-updated'))
    }
  }

  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const modalRef = useRef(null)

  useEffect(() => {
    const el = modalRef.current
    if (!el || window.innerWidth > 900) return

    let startY = 0
    let currentY = 0
    let isSwiping = false

    const onTouchStart = (e) => {
      const scrollable = e.target.closest('.settings-content') || e.target.closest('.settings-sidebar')
      if (scrollable && scrollable.scrollTop > 0) return
      
      startY = e.touches[0].clientY
      currentY = startY
      isSwiping = true
    }

    const onTouchMove = (e) => {
      if (!isSwiping) return
      currentY = e.touches[0].clientY
      const dy = currentY - startY
      
      if (dy > 0) {
        if (e.cancelable) e.preventDefault()
        el.style.transform = `translateY(${dy}px)`
        el.style.transition = 'none'
      } else {
        isSwiping = false
      }
    }

    const onTouchEnd = () => {
      if (!isSwiping) return
      isSwiping = false
      const dy = currentY - startY
      if (dy > 120) {
        el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out'
        el.style.transform = `translateY(100vh)`
        el.style.opacity = '0'
        if (el.parentElement) {
          el.parentElement.style.transition = 'opacity 0.2s ease-out'
          el.parentElement.style.opacity = '0'
        }
        setTimeout(() => onClose(), 200)
      } else {
        el.style.transform = ''
        el.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        setTimeout(() => { el.style.transition = '' }, 200)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onClose])

  return (
    <div className={`settings-overlay ${closing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="settings-modal" ref={modalRef}>
        <div className="settings-drag-handle" />
        <div className="settings-sidebar">
          <div className="settings-sidebar-label">User Settings</div>
          <div className="settings-nav">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  className={`settings-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
          <div className="settings-sidebar-sep" />
          <button className="settings-tab logout" onClick={() => setLogoutConfirm(true)}>
            <LogOut size={16} /> Log Out
          </button>
          <div className="settings-sidebar-footer">
            <span className="settings-sidebar-app">Medium</span>
            <span className="settings-sidebar-version">v1.0.0 — Make contact</span>
          </div>
        </div>

        <div className="settings-content">
          <button className="settings-close" onClick={handleClose}><X size={20} /></button>

          {tab === 'account' && <AccountTab settings={settings} onUpdate={update} />}
          {tab === 'appearance' && <AppearanceTab settings={settings} onUpdate={update} />}
          {tab === 'voice' && <VoiceTab settings={settings} onUpdate={update} voice={voice} onMicTestChange={(v, was) => { micTestActive.current = v; wasDeafenedBeforeRef.current = was }} />}
          {tab === 'notifications' && <NotificationsTab settings={settings} onUpdate={update} />}
          <div className="settings-footer-info">
            <span>Medium — Make contact</span>
            <div className="settings-footer-links">
              <span>This app uses local storage to save your preferences (<span className="legal-link" onClick={() => setLegalType('privacy')}>Privacy Policy</span>).</span>
              <span>By using Medium you agree to be respectful to other users on this network (<span className="legal-link" onClick={() => setLegalType('terms')}>Terms of Use</span>).</span>
            </div>
          </div>
        </div>
      </div>
      {logoutConfirm && (
        <ConfirmModal
          title="Log Out"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          danger
          onConfirm={() => { handleClose(); logout() }}
          onCancel={() => setLogoutConfirm(false)}
        />
      )}
      {legalType && (
        <LegalModal type={legalType} onClose={() => setLegalType(null)} />
      )}
    </div>
  )
}

function AccountTab({ settings, onUpdate }) {
  const { nickname, avatarColor, updateAvatarColor, userProfiles } = useAuth()
  const socket = useSocket()
  const getBio = useUserBio()
  const getAvatar = useUserAvatar()
  const getBanner = useUserBanner()
  const color = avatarColor || nicknameToColor(nickname)
  const currentBio = getBio(nickname)
  const currentAvatar = getAvatar(nickname)
  const currentBanner = getBanner(nickname)
  const [bioText, setBioText] = useState(currentBio)
  const [pendingAvatar, setPendingAvatar] = useState(null)
  const [pendingBanner, setPendingBanner] = useState(null)
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState(null)
  const [pendingBannerBlob, setPendingBannerBlob] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [removeBanner, setRemoveBanner] = useState(false)
  const [pendingColor, setPendingColor] = useState(null)
  const [saved, setSaved] = useState(false)
  const [cropModal, setCropModal] = useState(null)
  const [cropError, setCropError] = useState('')
  const avatarInputRef = useRef(null)
  const bannerInputRef = useRef(null)

  const displayAvatar = removeAvatar ? null : (pendingAvatar || currentAvatar)
  const displayBanner = removeBanner ? null : (pendingBanner || currentBanner)
  const displayColor = pendingColor || color
  const hasChanges = bioText !== currentBio || pendingAvatarBlob || pendingBannerBlob || removeAvatar || removeBanner || pendingColor

  const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const MAX_SIZE = 5 * 1024 * 1024

  async function uploadBlob(blob, type) {
    const formData = new FormData()
    formData.append('file', blob, `${type}_${Date.now()}.jpg`)
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    })
    if (res.ok) {
      const data = await res.json()
      socket.emit(`user:${type}`, data.url)
    }
  }

  function validateAndOpen(e, type) {
    setCropError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setCropError('Only JPG, PNG, GIF, WebP allowed')
      e.target.value = ''
      return
    }
    if (file.size > MAX_SIZE) {
      setCropError('Max file size is 5MB')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCropModal({ src: reader.result, type })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleCrop(blob, type) {
    const url = URL.createObjectURL(blob)
    if (type === 'avatar') {
      setPendingAvatar(url)
      setPendingAvatarBlob(blob)
      setRemoveAvatar(false)
    } else {
      setPendingBanner(url)
      setPendingBannerBlob(blob)
      setRemoveBanner(false)
    }
    setCropModal(null)
  }

  async function handleSave() {
    if (pendingAvatarBlob) await uploadBlob(pendingAvatarBlob, 'avatar')
    else if (removeAvatar) socket.emit('user:avatar', null)

    if (pendingBannerBlob) await uploadBlob(pendingBannerBlob, 'banner')
    else if (removeBanner) socket.emit('user:banner', null)

    if (bioText !== currentBio) socket.emit('user:bio', bioText)

    if (pendingColor) {
      onUpdate({ avatarColor: pendingColor })
      updateAvatarColor(pendingColor)
    }

    setPendingAvatar(null)
    setPendingBanner(null)
    setPendingAvatarBlob(null)
    setPendingBannerBlob(null)
    setRemoveAvatar(false)
    setRemoveBanner(false)
    setPendingColor(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCancel() {
    setBioText(currentBio)
    setPendingAvatar(null)
    setPendingBanner(null)
    setPendingAvatarBlob(null)
    setPendingBannerBlob(null)
    setRemoveAvatar(false)
    setRemoveBanner(false)
    setPendingColor(null)
    setCropError('')
  }

  return (
    <div className="settings-section">
      <h3>My Profile</h3>
      <div className="account-card">
        <div className="account-banner" style={{ background: displayColor }}>
          {displayBanner && <img src={displayBanner} alt="" className="account-banner-img" />}
          <div className="banner-edit-btns">
            <button onClick={() => bannerInputRef.current?.click()}><Camera size={16} /></button>
            {(displayBanner || pendingBanner) && <button onClick={() => { setPendingBanner(null); setPendingBannerBlob(null); setRemoveBanner(true) }}><Trash2 size={16} /></button>}
          </div>
          <input ref={bannerInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp" hidden onChange={(e) => validateAndOpen(e, 'banner')} />
        </div>
        <div className="account-info">
          <div className="account-avatar-wrap">
            <div className="account-avatar" style={displayAvatar ? {} : { background: displayColor }}>
              {displayAvatar ? <img src={displayAvatar} alt="" /> : nickname[0]?.toUpperCase()}
            </div>
            <div className="avatar-edit-btns">
              <button onClick={() => avatarInputRef.current?.click()}><Camera size={14} /></button>
              {(displayAvatar || pendingAvatar) && <button onClick={() => { setPendingAvatar(null); setPendingAvatarBlob(null); setRemoveAvatar(true) }}><Trash2 size={14} /></button>}
            </div>
            <input ref={avatarInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp" hidden onChange={(e) => validateAndOpen(e, 'avatar')} />
          </div>
          <div className="account-details">
            <span className="account-name">{nickname}</span>
            <span className="account-tag">@{nickname.toLowerCase().replace(/\s/g, '-')}</span>
          </div>
        </div>
      </div>

      {cropError && <div className="crop-error">{cropError}</div>}

      <div className="settings-group">
        <label>About Me</label>
        <div className="bio-wrapper">
          <textarea
            className="bio-input"
            rows={3}
            maxLength={190}
            placeholder="Tell others something about yourself..."
            value={bioText}
            onChange={(e) => setBioText(e.target.value.slice(0, 190))}
          />
          <span className="bio-counter">{MAX_BIO - bioText.length}</span>
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
              className={`color-swatch ${displayColor === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setPendingColor(c)}
            />
          ))}
        </div>
      </div>

      {hasChanges && (
        <div className="profile-actions">
          <button className="profile-btn save" onClick={handleSave}>Save Changes</button>
          <button className="profile-btn cancel" onClick={handleCancel}>Cancel</button>
        </div>
      )}

      {saved && <div className="profile-saved">Profile saved!</div>}

      {cropModal && (
        <CropModal
          imageSrc={cropModal.src}
          aspect={cropModal.type === 'avatar' ? 1 : 4.5}
          outputWidth={cropModal.type === 'avatar' ? 256 : 600}
          outputHeight={cropModal.type === 'avatar' ? 256 : 133}
          onCrop={(blob) => handleCrop(blob, cropModal.type)}
          onCancel={() => setCropModal(null)}
        />
      )}
    </div>
  )
}

function VoiceTab({ settings, onUpdate, voice, onMicTestChange }) {
  const [devices, setDevices] = useState([])
  const [outputDevices, setOutputDevices] = useState([])
  const [testVolume, setTestVolume] = useState(0)
  const [isTesting, setIsTesting] = useState(false)
  const audioRefs = useRef(null)
  const wasDeafenedBefore = useRef(false)
  const wasMutedBefore = useRef(false)

  useEffect(() => {
    if (!navigator.mediaDevices) {
      setDevices([])
      setOutputDevices([])
      return
    }
    navigator.mediaDevices.enumerateDevices().then((list) => {
      setDevices(list.filter((d) => d.kind === 'audioinput'))
      setOutputDevices(list.filter((d) => d.kind === 'audiooutput'))
    })
  }, [])

  useEffect(() => {
    let active = true;

    async function initMic() {
      try {
        if (!navigator.mediaDevices) return
        const constraints = settings.inputDevice
          ? { deviceId: { exact: settings.inputDevice } }
          : {}
        const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        const monitorGain = ctx.createGain()
        monitorGain.gain.value = 0
        source.connect(analyser)
        analyser.fftSize = 256

        const dest = ctx.createMediaStreamDestination()
        source.connect(analyser)
        analyser.connect(dest)
        source.connect(monitorGain)
        monitorGain.connect(dest)

        const audioEl = new Audio()
        audioEl.srcObject = dest.stream
        audioEl.volume = 0
        audioEl.play()

        audioRefs.current = { ctx, stream, source, analyser, monitorGain, audioEl }
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
        if (refs.audioEl) { refs.audioEl.pause(); refs.audioEl.srcObject = null }
        if (refs.stream) refs.stream.getTracks().forEach((t) => t.stop())
        if (refs.ctx) refs.ctx.close()
      }
      audioRefs.current = null;
    }
  }, [settings.inputDevice])

  function testMic() {
    const willTest = !isTesting
    if (audioRefs.current) {
      audioRefs.current.monitorGain.gain.value = willTest ? 1 : 0
      if (audioRefs.current.audioEl) audioRefs.current.audioEl.volume = willTest ? 1 : 0
    }
    if (willTest && voice.joined) {
      wasDeafenedBefore.current = voice.isDeafened
      wasMutedBefore.current = voice.isMuted
      if (!voice.isDeafened) {
        voice.toggleDeafen()
      }
    } else if (!willTest && voice.joined) {
      if (!wasDeafenedBefore.current) {
        voice.toggleDeafen()
      }
      if (wasMutedBefore.current && !voice.isMuted) {
        voice.toggleMute()
      }
    }
    setIsTesting(willTest)
    onMicTestChange?.(willTest, wasDeafenedBefore.current)
  }

  return (
    <div className="settings-section">
      <h3>Voice & Audio</h3>

      <div className="settings-medium-grid">
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
          <select
            value={settings.outputDevice || ''}
            onChange={(e) => onUpdate({ outputDevice: e.target.value })}
          >
            <option value="">Default</option>
            {outputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker ${outputDevices.indexOf(d) + 1}`}
              </option>
            ))}
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
        <div className="medium-mic-test-row">
          <button className="medium-test-btn" onClick={testMic}>
            {isTesting ? 'Stop testing' : 'Let\'s Check'}
          </button>
          <div className="medium-meter">
            {Array.from({ length: 40 }).map((_, i) => {
              const active = isTesting && (testVolume / 100) * 40 > i;
              const colorClass = i > 35 ? 'red' : i > 28 ? 'yellow' : '';
              return (
                <div key={i} className={`medium-meter-bar ${active ? 'active' : ''} ${active && colorClass ? colorClass : ''}`} />
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
                suffix="dB"
                displayValue={(val) => `-${100 - val}`}
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
        <div className="toggle-label">
          <CheckboxSwitch
            checked={settings.messageSound ?? true}
            onChange={(val) => onUpdate({ messageSound: val })}
          />
          <span>Message Notification Sound</span>
        </div>
      </div>

      <div className="settings-group">
        <div className="toggle-label">
          <CheckboxSwitch
            checked={settings.voiceJoinSound ?? true}
            onChange={(val) => onUpdate({ voiceJoinSound: val })}
          />
          <span>Voice Join / Leave Sound</span>
        </div>
      </div>

      <div className="settings-group">
        <div className="toggle-label">
          <CheckboxSwitch
            checked={settings.muteSound ?? true}
            onChange={(val) => onUpdate({ muteSound: val })}
          />
          <span>Mute / Deafen Sound</span>
        </div>
      </div>

      <div className="settings-group">
        <label>Sound Volume</label>
        <div className="range-row">
          <input type="range" min="0" max="100" value={settings.soundVolume ?? 80} onChange={(e) => onUpdate({ soundVolume: parseInt(e.target.value) })} />
          <span className="range-value">{settings.soundVolume ?? 80}%</span>
        </div>
      </div>
    </div>
  )
}
