import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'
import { loadSettings } from '../utils'

const VoiceContext = createContext(null)

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export function VoiceProvider({ children }) {
  const socket = useSocket()
  const { nickname } = useAuth()
  const [voiceChannel, setVoiceChannel] = useState(null)
  const [joined, setJoined] = useState(false)
  const [peers, setPeers] = useState([])
  const [speaking, setSpeaking] = useState({})
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
  const manualThresholdRef = useRef(127.5)
  const noiseBaselineRef = useRef(0)
  const baselineSamplesRef = useRef(0)

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
        inputGain.connect(dest)

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
      applyInputDevice()
    }

    window.addEventListener('settings-updated', handleSettingsUpdated)
    return () => window.removeEventListener('settings-updated', handleSettingsUpdated)
  }, [])

  function createPeerConnection(peerSocketId, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

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

  function createPeerConnections(peerList) {
    for (const peer of peerList) {
      const pc = createPeerConnection(peer.socketId, true)
      peerConnections.current[peer.socketId] = pc
    }
  }

  useEffect(() => {
    if (!socket) return

    function onPeers(list) {
      setPeers(list)
      if (list.length > 0) {
        createPeerConnections(list)
      }
    }

    function onUserJoined(data) {
      setPeers((prev) => [...prev, data])
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
    }

    function onSignal(data) {
      const { from, type, sdp, candidate } = data
      let pc = peerConnections.current[from]

      if (type === 'offer' && !pc) {
        pc = createPeerConnection(from, false)
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
    socket.on('voice:occupancy', setOccupancy)
    socket.on('voice:pong', (timestamp) => {
      const currentPing = Math.round(Date.now() - timestamp)
      setPing(currentPing)
      setPingHistory(prev => {
        const next = [...prev, { time: Date.now(), ping: currentPing }]
        if (next.length > 50) return next.slice(next.length - 50)
        return next
      })
    })

    return () => {
      socket.off('voice:peers', onPeers)
      socket.off('voice:user-joined', onUserJoined)
      socket.off('voice:user-left', onUserLeft)
      socket.off('voice:signal', onSignal)
      socket.off('voice:speaking', onSpeaking)
      socket.off('voice:occupancy', setOccupancy)
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

      const dest = audioContext.current.createMediaStreamDestination()

      source.connect(inputGain)
      inputGain.connect(dest)
      inputGain.connect(analyser)

      localStream.current = dest.stream
      rawStream.current = stream

      setVoiceChannel(channel)
      setJoined(true)
      socket.emit('voice:join', channel.id)
      localStorage.setItem('voice-channel', JSON.stringify({ id: channel.id, name: channel.name }))

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

      function detectSpeaking() {
        if (!rawStream.current) return
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

        let isSpeaking
        const mode = voiceModeRef.current
        const auto = autoSensitivityRef.current

        if (auto) {
          if (baselineSamplesRef.current < BASELINE_FRAMES) {
            noiseBaselineRef.current = (noiseBaselineRef.current * baselineSamplesRef.current + avg) / (baselineSamplesRef.current + 1)
            baselineSamplesRef.current++
            isSpeaking = avg > 5
          } else {
            isSpeaking = avg > noiseBaselineRef.current * 1.5 + 5
          }
        } else if (mode === 'studio') {
          isSpeaking = avg > 3
        } else {
          isSpeaking = avg > manualThresholdRef.current
        }
        socket.emit('voice:speaking', isSpeaking)
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

  function leaveVoice() {
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
    setIsMuted(false)
    setIsDeafened(false)
    setPing(null)
    setPingHistory([])
    setPacketLoss(0)
    localStorage.removeItem('voice-channel')
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
  }

  function toggleDeafen() {
    const next = !isDeafened
    setIsDeafened(next)
    Object.values(remoteAudioRefs.current).forEach((audio) => {
      if (audio) audio.muted = next
    })
    if (next && !isMuted) {
      if (rawStream.current) {
        rawStream.current.getAudioTracks().forEach((t) => { t.enabled = false })
      }
      isMutedRef.current = true
      setIsMuted(true)
    } else if (!next && isMuted) {
      if (rawStream.current) {
        rawStream.current.getAudioTracks().forEach((t) => { t.enabled = true })
      }
      isMutedRef.current = false
      setIsMuted(false)
    }
  }

  return (
    <VoiceContext.Provider value={{
      joined,
      voiceChannel,
      peers,
      speaking,
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
