import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export default function VoiceChannel({ channel }) {
  const socket = useSocket()
  const { nickname } = useAuth()
  const [joined, setJoined] = useState(false)
  const [peers, setPeers] = useState([])
  const [speaking, setSpeaking] = useState({})
  const peerConnections = useRef({})
  const localStream = useRef(null)
  const audioContext = useRef(null)
  const remoteAudioRefs = useRef({})

  useEffect(() => {
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

    return () => {
      socket.off('voice:peers', onPeers)
      socket.off('voice:user-joined', onUserJoined)
      socket.off('voice:user-left', onUserLeft)
      socket.off('voice:signal', onSignal)
      socket.off('voice:speaking', onSpeaking)
      leaveVoice()
    }
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

  async function joinVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStream.current = stream
      setJoined(true)
      socket.emit('voice:join', channel.id)

      audioContext.current = new AudioContext()
      const analyser = audioContext.current.createAnalyser()
      const source = audioContext.current.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let speakingTimeout = null

      function detectSpeaking() {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const isSpeaking = avg > 10

        socket.emit('voice:speaking', isSpeaking)
        if (joined) requestAnimationFrame(detectSpeaking)
      }
      detectSpeaking()
    } catch (err) {
      console.error('Microphone access denied:', err)
      alert('Microphone access is required for voice channels')
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
    setPeers([])
    setSpeaking({})
    socket.emit('voice:leave')
  }

  return (
    <div className="voice-container">
      <div className="voice-header">
        <span>🔊 {channel.name}</span>
      </div>

      <div className="voice-body">
        {joined && (
          <div className="voice-self">
            <div className={`voice-avatar speaking-${speaking[socket.id] ? 'active' : 'idle'}`}>
              {nickname[0]?.toUpperCase()}
            </div>
            <span>{nickname} (you)</span>
          </div>
        )}

        {peers.map((p) => (
          <div key={p.socketId} className="voice-peer">
            <div className={`voice-avatar speaking-${speaking[p.socketId] ? 'active' : 'idle'}`}>
              {p.nickname[0]?.toUpperCase()}
            </div>
            <span>{p.nickname}</span>
            <audio
              ref={(el) => { remoteAudioRefs.current[p.socketId] = el }}
              autoPlay
              playsInline
            />
          </div>
        ))}

        {joined && peers.length === 0 && (
          <p className="voice-empty">You're alone here. Invite someone!</p>
        )}
      </div>

      <div className="voice-controls">
        {!joined ? (
          <button className="voice-join-btn" onClick={joinVoice}>
            Join Voice
          </button>
        ) : (
          <button className="voice-leave-btn" onClick={leaveVoice}>
            Leave Voice
          </button>
        )}
      </div>
    </div>
  )
}
