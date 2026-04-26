import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'

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
  const peerConnections = useRef({})
  const localStream = useRef(null)
  const audioContext = useRef(null)
  const remoteAudioRefs = useRef({})

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

    return () => {
      socket.off('voice:peers', onPeers)
      socket.off('voice:user-joined', onUserJoined)
      socket.off('voice:user-left', onUserLeft)
      socket.off('voice:signal', onSignal)
      socket.off('voice:speaking', onSpeaking)
      socket.off('voice:occupancy', setOccupancy)
    }
  }, [socket])

  async function joinVoice(channel) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStream.current = stream
      setVoiceChannel(channel)
      setJoined(true)
      socket.emit('voice:join', channel.id)

      audioContext.current = new AudioContext()
      const analyser = audioContext.current.createAnalyser()
      const source = audioContext.current.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      function detectSpeaking() {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        socket.emit('voice:speaking', avg > 10)
        requestAnimationFrame(detectSpeaking)
      }
      detectSpeaking()
    } catch (err) {
      console.error('Microphone access denied:', err)
    }
  }

  function leaveVoice() {
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop())
      localStream.current = null
    }
    if (audioContext.current) {
      audioContext.current.close()
      audioContext.current = null
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close())
    peerConnections.current = {}
    setJoined(false)
    setVoiceChannel(null)
    setPeers([])
    setSpeaking({})
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
    }}>
      {children}
      {joined && peers.map((p) => (
        <audio
          key={`remote-audio-${p.socketId}`}
          ref={(el) => { remoteAudioRefs.current[p.socketId] = el }}
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
