import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'
import { loadSettings } from '../utils'
import { playVoiceJoinSound, playVoiceLeaveSound, playMuteSound, playUnmuteSound, playDeafenSound, playUndeafenSound } from '../utils/notif'

const VoiceContext = createContext(null)

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

let cachedIceServers = null
async function getIceServers() {
  if (cachedIceServers) return cachedIceServers
  try {
    const res = await fetch('/api/ice-servers')
    if (res.ok) {
      cachedIceServers = await res.json()
      setTimeout(() => { cachedIceServers = null }, 3600000)
      return cachedIceServers
    }
  } catch {}
  return ICE_SERVERS
}

export function VoiceProvider({ children }) {
  const socket = useSocket()
  const { nickname } = useAuth()
  const [voiceChannel, setVoiceChannel] = useState(null)
  const [joined, setJoined] = useState(false)
  const [peers, setPeers] = useState([])
  const [speaking, setSpeaking] = useState({})
  const [peerMuted, setPeerMuted] = useState({})
  const [peerDeafened, setPeerDeafened] = useState({})
  const [voiceStates, setVoiceStates] = useState({})
  const [occupancy, setOccupancy] = useState({})
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [ping, setPing] = useState(null)
  const [pingHistory, setPingHistory] = useState([])
  const [packetLoss, setPacketLoss] = useState(0)
  const peerConnections = useRef({})
  const rawStream = useRef(null)
  const localStream = useRef(null)
  const audioContext = useRef(null)
  const remoteAudioRefs = useRef({})
  const pingInterval = useRef(null)
  const autoRejoined = useRef(false)
  const rafId = useRef(null)
  const isMutedRef = useRef(false)
  const voiceModeRef = useRef(null)
  const autoSensitivityRef = useRef(false)
  const manualThresholdRef = useRef(null)
  const noiseBaselineRef = useRef(0)
  const baselineSamplesRef = useRef(0)
  const gateGainRef = useRef(null)
  const lastInputDeviceRef = useRef(null)
  const analyserRef = useRef(null)

  useEffect(() => {
    if (!socket || autoRejoined.current) return
    autoRejoined.current = true

    try {
      const saved = JSON.parse(localStorage.getItem('voice-channel'))
      if (saved?.id && saved?.name) {
        joinVoice(saved)
      }
    } catch {}
  }, [socket])

  useEffect(() => {
    function applyOutputDevice() {
      const settings = loadSettings()
      const sinkId = settings.outputDevice || ''
      Object.values(remoteAudioRefs.current).forEach((audio) => {
        if (audio && sinkId && typeof audio.setSinkId === 'function') {
          audio.setSinkId(sinkId).catch(() => {})
        }
      })
    }

    async function applyInputDevice() {
      const settings = loadSettings()
      const deviceId = settings.inputDevice
      if (!rawStream.current || !audioContext.current) return
      try {
        const constraints = deviceId ? { deviceId: { exact: deviceId } } : {}
        const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
        const newSource = audioContext.current.createMediaStreamSource(stream)
        const inputGain = audioContext.current.createGain()
        inputGain.gain.value = (settings.inputVolume ?? 100) / 100
        const dest = audioContext.current.createMediaStreamDestination()

        newSource.connect(inputGain)
        if (gateGainRef.current) {
          inputGain.connect(gateGainRef.current)
          gateGainRef.current.connect(dest)
        } else {
          inputGain.connect(dest)
        }
        if (analyserRef.current) {
          inputGain.connect(analyserRef.current)
        }

        if (isMutedRef.current) {
          stream.getAudioTracks().forEach(t => { t.enabled = false })
        }

        if (rawStream.current) rawStream.current.getTracks().forEach(t => t.stop())
        rawStream.current = stream
        localStream.current = dest.stream

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
          if (sender) {
            dest.stream.getAudioTracks().forEach(t => sender.replaceTrack(t))
          }
        })
      } catch (err) {
        console.error('Failed to switch input device:', err)
      }
    }

    function handleSettingsUpdated() {
      const s = loadSettings()
      voiceModeRef.current = s.voiceMode
      autoSensitivityRef.current = s.autoInputSensitivity ?? false
      manualThresholdRef.current = (s.inputSensitivity ?? 50) * 2.55
      if (s.autoInputSensitivity) {
        noiseBaselineRef.current = 0
        baselineSamplesRef.current = 0
      }
      applyOutputDevice()
      if (s.inputDevice !== lastInputDeviceRef.current) {
        lastInputDeviceRef.current = s.inputDevice
        applyInputDevice()
      }
    }

    window.addEventListener('settings-updated', handleSettingsUpdated)
    return () => window.removeEventListener('settings-updated', handleSettingsUpdated)
  }, [])

  async function createPeerConnection(peerSocketId, isInitiator) {
    const servers = await getIceServers()
    const pc = new RTCPeerConnection({ iceServers: servers })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('voice:signal', {
          target: peerSocketId,
          type: 'ice-candidate',
          candidate: e.candidate,
        })
      }
    }

    pc.ontrack = (e) => {
      const audio = remoteAudioRefs.current[peerSocketId]
      if (audio) {
        audio.srcObject = e.streams[0]
      }
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => pc.addTrack(t, localStream.current))
    }

    if (isInitiator) {
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).then(() => {
        socket.emit('voice:signal', {
          target: peerSocketId,
          type: 'offer',
          sdp: pc.localDescription,
        })
      })
    }

    return pc
  }

  async function createPeerConnections(peerList) {
    for (const peer of peerList) {
      const pc = await createPeerConnection(peer.socketId, true)
      peerConnections.current[peer.socketId] = pc
    }
  }

  useEffect(() => {
    if (!socket) return

    async function onPeers(list) {
      setPeers(list)
      const muted = {}
      const deafened = {}
      list.forEach(p => {
        if (p.isMuted) muted[p.socketId] = true
        if (p.isDeafened) deafened[p.socketId] = true
      })
      setPeerMuted(muted)
      setPeerDeafened(deafened)
      if (list.length > 0) {
        await createPeerConnections(list)
      }
    }

    function onUserJoined(data) {
      setPeers((prev) => [...prev, data])
      if (data.isMuted) setPeerMuted((prev) => ({ ...prev, [data.socketId]: true }))
      if (data.isDeafened) setPeerDeafened((prev) => ({ ...prev, [data.socketId]: true }))
    }

    function onUserLeft(data) {
      setPeers((prev) => prev.filter((p) => p.socketId !== data.socketId))
      if (peerConnections.current[data.socketId]) {
        peerConnections.current[data.socketId].close()
        delete peerConnections.current[data.socketId]
      }
      setSpeaking((prev) => {
        const copy = { ...prev }
        delete copy[data.socketId]
        return copy
      })
      setPeerMuted((prev) => {
        const copy = { ...prev }
        delete copy[data.socketId]
        return copy
      })
      setPeerDeafened((prev) => {
        const copy = { ...prev }
        delete copy[data.socketId]
        return copy
      })
    }

    function onPeerMute(data) {
      setPeerMuted((prev) => ({ ...prev, [data.socketId]: data.muted }))
      if (data.muted) setSpeaking((prev) => ({ ...prev, [data.socketId]: false }))
    }

    function onPeerDeafen(data) {
      setPeerDeafened((prev) => ({ ...prev, [data.socketId]: data.deafened }))
      if (data.deafened) {
        setSpeaking((prev) => ({ ...prev, [data.socketId]: false }))
        setPeerMuted((prev) => ({ ...prev, [data.socketId]: true }))
      }
    }

    async function onSignal(data) {
      const { from, type, sdp, candidate } = data
      let pc = peerConnections.current[from]

      if (type === 'offer' && !pc) {
        pc = await createPeerConnection(from, false)
        peerConnections.current[from] = pc
      }

      if (sdp) {
        pc?.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => {
          if (type === 'offer' && pc) {
            pc.createAnswer().then((answer) => pc.setLocalDescription(answer)).then(() => {
              socket.emit('voice:signal', { target: from, type: 'answer', sdp: pc.localDescription })
            })
          }
        })
      }

      if (candidate && pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    }

    function onSpeaking(data) {
      setSpeaking((prev) => ({ ...prev, [data.socketId]: data.isSpeaking }))
    }

    socket.on('voice:peers', onPeers)
    socket.on('voice:user-joined', onUserJoined)
    socket.on('voice:user-left', onUserLeft)
    socket.on('voice:signal', onSignal)
    socket.on('voice:speaking', onSpeaking)
    socket.on('voice:mute', onPeerMute)
    socket.on('voice:deafen', onPeerDeafen)
    socket.on('voice:occupancy', setOccupancy)
    socket.on('voice:states', setVoiceStates)
    socket.on('voice:pong', (timestamp) => {
      const currentPing = Math.round(Date.now() - timestamp)
      setPing(currentPing)
      setPingHistory(prev => {
        const next = [...prev, { time: Date.now(), ping: currentPing }]
        if (next.length > 50) return next.slice(next.length - 50)
        return next
      })
    })

    socket.on('voice:kicked', () => {
      playVoiceLeaveSound()
      cleanupVoice()
    })

    return () => {
      socket.off('voice:peers', onPeers)
      socket.off('voice:user-joined', onUserJoined)
      socket.off('voice:user-left', onUserLeft)
      socket.off('voice:signal', onSignal)
      socket.off('voice:speaking', onSpeaking)
      socket.off('voice:speaking', onSpeaking)
      socket.off('voice:mute', onPeerMute)
      socket.off('voice:deafen', onPeerDeafen)
      socket.off('voice:occupancy', setOccupancy)
      socket.off('voice:states', setVoiceStates)
      socket.off('voice:pong')
    }
  }, [socket])

  async function joinVoice(channel) {
    try {
      if (!navigator.mediaDevices) throw new Error('MediaDevices not available (requires HTTPS)')
      const settings = loadSettings()
      const constraints = settings.inputDevice
        ? { audio: { deviceId: { exact: settings.inputDevice } } }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      audioContext.current = new AudioContext()
      const source = audioContext.current.createMediaStreamSource(stream)
      const inputGain = audioContext.current.createGain()
      inputGain.gain.value = (settings.inputVolume ?? 100) / 100

      const analyser = audioContext.current.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const dest = audioContext.current.createMediaStreamDestination()
      const gateGain = audioContext.current.createGain()
      gateGain.gain.value = 1
      gateGainRef.current = gateGain

      source.connect(inputGain)
      inputGain.connect(gateGain)
      gateGain.connect(dest)
      inputGain.connect(analyser)

      localStream.current = dest.stream
      rawStream.current = stream

      setVoiceChannel(channel)
      setJoined(true)
      playVoiceJoinSound()
      socket.emit('voice:join', channel.id)
      localStorage.setItem('voice-channel', JSON.stringify({ id: channel.id, name: channel.name }))

      const wasMuted = localStorage.getItem('voice-muted') === 'true'
      const wasDeafened = localStorage.getItem('voice-deafened') === 'true'
      if (wasMuted || wasDeafened) {
        if (rawStream.current) rawStream.current.getAudioTracks().forEach((t) => { t.enabled = false })
        isMutedRef.current = true
        setIsMuted(true)
      }
      if (wasDeafened) {
        setIsDeafened(true)
        Object.values(remoteAudioRefs.current).forEach((audio) => { if (audio) audio.muted = true })
        socket.emit('voice:mute', true)
        socket.emit('voice:deafen', true)
      } else if (wasMuted) {
        socket.emit('voice:mute', true)
      }

      const outputVol = (settings.outputVolume ?? 100) / 100
      const sinkId = settings.outputDevice || ''
      Object.values(remoteAudioRefs.current).forEach((audio) => {
        if (audio) {
          audio.volume = Math.min(outputVol, 2)
          if (sinkId && typeof audio.setSinkId === 'function') audio.setSinkId(sinkId)
        }
      })

      voiceModeRef.current = settings.voiceMode
      autoSensitivityRef.current = settings.autoInputSensitivity ?? false
      manualThresholdRef.current = (settings.inputSensitivity ?? 50) * 2.55
      noiseBaselineRef.current = 0
      baselineSamplesRef.current = 0

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const BASELINE_FRAMES = 120

      let lastSentSpeaking = null
      let lastActiveTime = 0
      const SPEAKING_HOLD_MS = 300

      function detectSpeaking() {
        if (!rawStream.current) return
        const timeData = new Uint8Array(analyser.fftSize)
        analyser.getByteTimeDomainData(timeData)
        let sum = 0
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / timeData.length)
        const level = rms * 100

      let rawSpeaking
      const mode = voiceModeRef.current
      const auto = autoSensitivityRef.current

      if (isMutedRef.current) {
        rawSpeaking = false
      } else if (mode === 'studio' || !mode) {
        rawSpeaking = level > 2
      } else if (auto) {
        if (baselineSamplesRef.current < BASELINE_FRAMES) {
          noiseBaselineRef.current = (noiseBaselineRef.current * baselineSamplesRef.current + level) / (baselineSamplesRef.current + 1)
          baselineSamplesRef.current++
          rawSpeaking = level > 2
        } else {
          rawSpeaking = level > noiseBaselineRef.current * 1.5 + 3
        }
      } else {
        const threshold = manualThresholdRef.current ?? 128
        rawSpeaking = level > threshold / 8
      }

      if (gateGainRef.current && audioContext.current) {
        const now = audioContext.current.currentTime
        const rampTime = 0.05
        if (isMutedRef.current) {
          gateGainRef.current.gain.linearRampToValueAtTime(0, now + 0.01)
        } else if (mode === 'studio' || !mode) {
          gateGainRef.current.gain.linearRampToValueAtTime(1, now + 0.01)
        } else if (rawSpeaking) {
          gateGainRef.current.gain.linearRampToValueAtTime(1, now + rampTime)
        } else if (Date.now() - lastActiveTime < 150) {
          gateGainRef.current.gain.linearRampToValueAtTime(1, now + 0.01)
        } else {
          gateGainRef.current.gain.linearRampToValueAtTime(0, now + rampTime)
        }
      }

        if (rawSpeaking) lastActiveTime = Date.now()
        const isSpeaking = rawSpeaking || (Date.now() - lastActiveTime < SPEAKING_HOLD_MS)

        setSpeaking(prev => ({ ...prev, [socket?.id]: isSpeaking }))

        if (isSpeaking !== lastSentSpeaking) {
          lastSentSpeaking = isSpeaking
          socket.emit('voice:speaking', isSpeaking)
        }
        rafId.current = requestAnimationFrame(detectSpeaking)
      }
      detectSpeaking()

      pingInterval.current = setInterval(() => {
        socket.emit('voice:ping', Date.now())
        
        let packetsSent = 0
        let packetsLost = 0
        Promise.all(Object.values(peerConnections.current).map(pc => pc.getStats())).then(statsArray => {
          statsArray.forEach(stats => {
            stats.forEach(report => {
              if (report.type === 'outbound-rtp') packetsSent += report.packetsSent || 0
              if (report.type === 'remote-inbound-rtp' || report.type === 'inbound-rtp') packetsLost += report.packetsLost || 0
            })
          })
          if (packetsSent > 0) {
            const lossRatio = (packetsLost / (packetsSent + packetsLost)) * 100
            setPacketLoss(Number(lossRatio.toFixed(1)))
          }
        }).catch(() => {})
      }, 5000)
      socket.emit('voice:ping', Date.now())
    } catch (err) {
      console.error('Microphone access denied:', err)
    }
  }

  function cleanupVoice() {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    if (rawStream.current) {
      rawStream.current.getTracks().forEach((t) => t.stop())
      rawStream.current = null
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop())
      localStream.current = null
    }
    if (audioContext.current) {
      audioContext.current.close()
      audioContext.current = null
    }
    if (pingInterval.current) {
      clearInterval(pingInterval.current)
      pingInterval.current = null
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close())
    peerConnections.current = {}
    setJoined(false)
    setVoiceChannel(null)
    setPeers([])
    setSpeaking({})
    setPeerMuted({})
    setPeerDeafened({})
    setIsMuted(false)
    setIsDeafened(false)
    setPing(null)
    setPingHistory([])
    setPacketLoss(0)
    localStorage.removeItem('voice-channel')
    localStorage.removeItem('voice-muted')
    localStorage.removeItem('voice-deafened')
  }

  function leaveVoice() {
    playVoiceLeaveSound()
    cleanupVoice()
    socket.emit('voice:leave')
  }

  function applyUserAudio(nickname) {
    const vol = localStorage.getItem(`user-volume:${nickname}`)
    const muted = localStorage.getItem(`user-muted:${nickname}`) === 'true'
    for (const [, pc] of Object.entries(peerConnections.current)) {
      const receivers = pc.getReceivers()
      if (receivers.length > 0) {
        const stream = new MediaStream(receivers.map((r) => r.track).filter(Boolean))
        if (stream.getTracks().length > 0) {
          const audio = remoteAudioRefs.current[Object.keys(peerConnections.current).find(k => peerConnections.current[k] === pc)]
          if (audio) {
            audio.volume = Math.min((vol ? parseInt(vol) : 100) / 100, 2)
            audio.muted = muted
          }
        }
      }
    }
  }

  function setUserVolume(peerNickname, volume) {
    localStorage.setItem(`user-volume:${peerNickname}`, volume)
    const peer = peers.find((p) => p.nickname === peerNickname)
    if (peer) {
      const audio = remoteAudioRefs.current[peer.socketId]
      if (audio) audio.volume = Math.min(volume / 100, 2)
    }
  }

  function toggleUserMute(peerNickname) {
    const current = localStorage.getItem(`user-muted:${peerNickname}`) === 'true'
    const next = !current
    localStorage.setItem(`user-muted:${peerNickname}`, String(next))
    const peer = peers.find((p) => p.nickname === peerNickname)
    if (peer) {
      const audio = remoteAudioRefs.current[peer.socketId]
      if (audio) audio.muted = next
    }
    return next
  }

  function isUserMuted(peerNickname) {
    return localStorage.getItem(`user-muted:${peerNickname}`) === 'true'
  }

  function getUserVolume(peerNickname) {
    return parseInt(localStorage.getItem(`user-volume:${peerNickname}`) || '100')
  }

  function toggleMute() {
    if (!rawStream.current) return
    const next = !isMuted
    rawStream.current.getAudioTracks().forEach((t) => { t.enabled = !next })
    isMutedRef.current = next
    setIsMuted(next)
    localStorage.setItem('voice-muted', String(next))
    socket?.emit('voice:mute', next)
    next ? playMuteSound() : playUnmuteSound()
  }

  const wasMutedBeforeDeafen = useRef(false)

  function toggleDeafen() {
    const next = !isDeafened
    setIsDeafened(next)
    localStorage.setItem('voice-deafened', String(next))
    Object.values(remoteAudioRefs.current).forEach((audio) => {
      if (audio) audio.muted = next
    })
    if (next) {
      wasMutedBeforeDeafen.current = isMuted
      if (!isMuted) {
        if (rawStream.current) {
          rawStream.current.getAudioTracks().forEach((t) => { t.enabled = false })
        }
        isMutedRef.current = true
        setIsMuted(true)
        localStorage.setItem('voice-muted', 'true')
      }
    } else if (!next) {
      if (!wasMutedBeforeDeafen.current) {
        if (rawStream.current) {
          rawStream.current.getAudioTracks().forEach((t) => { t.enabled = true })
        }
        isMutedRef.current = false
        setIsMuted(false)
        localStorage.setItem('voice-muted', 'false')
      }
    }
    socket?.emit('voice:deafen', next)
    next ? playDeafenSound() : playUndeafenSound()
  }

  return (
    <VoiceContext.Provider value={{
      joined,
      voiceChannel,
      peers,
      speaking,
      peerMuted,
      peerDeafened,
      voiceStates,
      occupancy,
      joinVoice,
      leaveVoice,
      remoteAudioRefs,
      nickname,
      socketId: socket?.id,
      setUserVolume,
      toggleUserMute,
      isUserMuted,
      getUserVolume,
      isMuted,
      isDeafened,
      toggleMute,
      toggleDeafen,
      ping,
      pingHistory,
      packetLoss,
    }}>
      {children}
      {joined && peers.map((p) => (
        <audio
          key={`remote-audio-${p.socketId}`}
          ref={(el) => {
            if (el) {
              const settings = loadSettings()
              el.volume = Math.min((settings.outputVolume ?? 100) / 100, 2)
              const sinkId = settings.outputDevice || ''
              if (sinkId && typeof el.setSinkId === 'function') el.setSinkId(sinkId)
            }
            remoteAudioRefs.current[p.socketId] = el
          }}
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />
      ))}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  return useContext(VoiceContext)
}
