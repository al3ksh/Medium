import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useVoice } from '../contexts/VoiceContext'
import { useAvatarColor, useUserColor, useUserAvatar } from '../contexts/AuthContext'
import { nicknameToColor } from '../utils'
import { Volume2, VolumeX, Mic, MicOff, Headphones, PhoneOff, Radio, Monitor, MonitorOff, Play, Settings, Volume1, Maximize, Minimize, Eye } from 'lucide-react'
import ConnectionDetailsModal from './ConnectionDetailsModal'

export function SignalBars({ ping }) {
  const quality = ping <= 40 ? '4' : ping <= 70 ? '3' : ping <= 150 ? '2' : '1'
  const activeBars = ping <= 40 ? 4 : ping <= 70 ? 3 : ping <= 150 ? 2 : 1
  return (
    <div className="signal-bars" title={`${ping}ms`} data-quality={quality}>
      {[1, 2, 3, 4].map((level) => (
        <div key={level} className={`signal-bar ${level <= activeBars ? 'active' : ''}`} style={{ height: `${3 + level * 3}px` }} />
      ))}
    </div>
  )
}

export default function VoiceChannel({ channel, onUserClick, onUserContextMenu }) {
  const { joined, voiceChannel, peers, speaking, peerMuted, peerDeafened, joinVoice, leaveVoice, nickname, socketId, isMuted, isDeafened, toggleMute, toggleDeafen, ping, occupancy, voiceStates, isScreenSharing, screenStreams, screenPresenters, streamViewers, startScreenShare, stopScreenShare, applyStreamQuality, viewingScreen, setViewingScreen, socket } = useVoice()
  const selfColor = useAvatarColor()
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()
  const isActive = joined && voiceChannel?.id === channel.id
  const [showDetails, setShowDetails] = useState(false)
  const [showStreamMenu, setShowStreamMenu] = useState(false)
  const [joinedStreams, setJoinedStreams] = useState(() => new Set())
  const [streamRes, setStreamRes] = useState(() => localStorage.getItem('stream-res') || '720p')
  const [streamFps, setStreamFps] = useState(() => localStorage.getItem('stream-fps') || '30')
  const [streamAudio, setStreamAudio] = useState(() => localStorage.getItem('stream-audio') !== 'false')
  const [streamCtx, setStreamCtx] = useState(null)
  const [streamVolumes, setStreamVolumes] = useState(() => JSON.parse(localStorage.getItem('stream-volumes') || '{}'))
  const [fullscreenStream, setFullscreenStream] = useState(null)
  const [showViewers, setShowViewers] = useState(null)
  const streamMenuRef = useRef(null)
  const streamVideoRefs = useRef({})
  const playerRef = useRef(null)

  useEffect(() => {
    if (!showStreamMenu) return
    function handleClick(e) {
      if (streamMenuRef.current && !streamMenuRef.current.contains(e.target)) setShowStreamMenu(false)
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [showStreamMenu])

  useEffect(() => {
    setJoinedStreams(prev => {
      const next = new Set(prev)
      let changed = false
      for (const sid of next) {
        if (!screenPresenters[sid]) { next.delete(sid); changed = true }
      }
      if (screenPresenters[socketId] && !next.has(socketId)) { next.add(socketId); changed = true }
      return changed ? next : prev
    })
  }, [screenPresenters, socketId])

  useEffect(() => {
    for (const [sid, vol] of Object.entries(streamVolumes)) {
      const el = streamVideoRefs.current[sid]
      if (el) el.volume = vol.muted ? 0 : (vol.level ?? 1)
    }
  }, [streamVolumes, viewingScreen, screenStreams])

  const setStreamVolume = useCallback((sid, level) => {
    setStreamVolumes(prev => {
      const next = { ...prev, [sid]: { ...prev[sid], level, muted: false } }
      localStorage.setItem('stream-volumes', JSON.stringify(next))
      return next
    })
  }, [])

  const toggleStreamMute = useCallback((sid) => {
    setStreamVolumes(prev => {
      const cur = prev[sid] || { level: 1, muted: false }
      const next = { ...prev, [sid]: { ...cur, muted: !cur.muted } }
      localStorage.setItem('stream-volumes', JSON.stringify(next))
      return next
    })
  }, [])

  const joinStream = useCallback((sid) => {
    setJoinedStreams(prev => new Set(prev).add(sid))
    socket?.emit('voice:stream-join', sid)
  }, [socket])

  const leaveStream = useCallback((sid) => {
    setJoinedStreams(prev => { const n = new Set(prev); n.delete(sid); return n })
    socket?.emit('voice:stream-leave', sid)
  }, [socket])

  const openFullscreen = useCallback((sid) => {
    setFullscreenStream(sid)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        playerRef.current?.requestFullscreen?.() || playerRef.current?.webkitRequestFullscreen?.()
      })
    })
  }, [])

  useEffect(() => {
    if (fullscreenStream === null) return
    function onFsChange() {
      if (!document.fullscreenElement) setFullscreenStream(null)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [fullscreenStream])

  const channelUsers = occupancy[channel.id] || []
  const hasUsers = channelUsers.length > 0

  return (
    <div className="voice-container">
      <div className="voice-header">
        <Volume2 size={20} />
        <span>{channel.name}</span>
      </div>

      <div className="voice-body">
        {isActive && peers.length === 0 && (
          <p className="voice-empty-top">You're alone here. Invite someone!</p>
        )}

        {isActive && (
          <>
            {Object.keys(screenPresenters).length > 0 && (
              <div className="stream-section">
                {viewingScreen ? (
                  <div className="stream-expanded">
                    <div className="stream-main" onClick={() => setViewingScreen(null)} title="Click to minimize" onContextMenu={(e) => { e.preventDefault(); setStreamCtx({ sid: viewingScreen, x: e.clientX, y: e.clientY }) }}>
                      {screenStreams[viewingScreen] ? (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => { if (el) { streamVideoRefs.current[viewingScreen] = el; if (el.srcObject !== screenStreams[viewingScreen]) el.srcObject = screenStreams[viewingScreen] } }}
                        />
                      ) : (
                        <div className="stream-thumb-placeholder" style={{ background: getColor(screenPresenters[viewingScreen]) }}>
                          {getAvatar(screenPresenters[viewingScreen]) ? <img src={getAvatar(screenPresenters[viewingScreen])} alt="" /> : screenPresenters[viewingScreen][0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="stream-main-bar">
                        <Monitor size={14} />
                        <span>{screenPresenters[viewingScreen]}</span>
                        <div className="stream-viewers-wrap">
                          <button type="button" className={`stream-viewers-btn${showViewers === viewingScreen ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); setShowViewers(v => v === viewingScreen ? null : viewingScreen) }}>
                            <Eye size={14} />
                            <span>{(streamViewers[viewingScreen] || []).length || 0}</span>
                          </button>
                          {showViewers === viewingScreen && (
                            <div className="stream-viewers-list" onClick={(e) => e.stopPropagation()}>
                              {(streamViewers[viewingScreen] || []).length === 0 && <span className="stream-viewers-empty">No viewers yet</span>}
                              {(streamViewers[viewingScreen] || []).map((vName, i) => (
                                <div key={i} className="stream-viewer-item">
                                  <div className="voice-avatar-sm" style={getAvatar(vName) ? {} : { background: getColor(vName) }}>
                                    {getAvatar(vName) ? <img src={getAvatar(vName)} alt="" /> : vName[0]?.toUpperCase()}
                                  </div>
                                  <span>{vName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="stream-main-actions">
                          <button type="button" className="stream-main-action" onClick={(e) => {
                            e.stopPropagation()
                            if (viewingScreen !== socketId) leaveStream(viewingScreen)
                            setViewingScreen(null)
                          }}>
                            <MonitorOff size={14} /> Stop Watching
                          </button>
                          <button type="button" className="stream-main-action" onClick={(e) => { e.stopPropagation(); openFullscreen(viewingScreen) }} title="Fullscreen">
                            <Maximize size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="stream-mini-row">
                      {Object.entries(screenPresenters).filter(([sid]) => sid !== viewingScreen).map(([sid, name]) => {
                        const isJoined = joinedStreams.has(sid)
                        return (
                          <button type="button" key={sid} className="stream-mini-thumb" onClick={() => isJoined ? setViewingScreen(sid) : joinStream(sid)}>
                            {isJoined && screenStreams[sid] && (
                              <video autoPlay playsInline muted ref={(el) => { if (el && el.srcObject !== screenStreams[sid]) el.srcObject = screenStreams[sid] }} />
                            )}
                            {(!isJoined || !screenStreams[sid]) && (
                              <div className="stream-thumb-placeholder" style={{ background: getColor(name) }}>
                                {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="stream-mini-label">{name}</span>
                            <span className="stream-mini-live">LIVE</span>
                            {!isJoined && <span className="stream-mini-watch">Watch</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="stream-thumbnail-row">
                    {Object.entries(screenPresenters).map(([sid, name]) => {
                      const isJoined = joinedStreams.has(sid)
                      const isSelf = sid === socketId
                      return (
                        <div key={sid} className={`stream-thumb${isJoined ? ' joined' : ''}`} onContextMenu={(e) => { e.preventDefault(); setStreamCtx({ sid, x: e.clientX, y: e.clientY }) }}>
                          <button type="button" className="stream-thumb-click" onClick={() => isJoined ? setViewingScreen(sid) : joinStream(sid)}>
                            <div className="stream-thumb-video">
                              {isJoined && screenStreams[sid] ? (
                                <video autoPlay playsInline muted ref={(el) => { if (el && el.srcObject !== screenStreams[sid]) el.srcObject = screenStreams[sid] }} />
                              ) : (
                                <div className="stream-thumb-placeholder" style={{ background: getColor(name) }}>
                                  {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
                                </div>
                              )}
                              {!isJoined && (
                                <div className="stream-thumb-overlay">
                                  <Play size={20} fill="currentColor" />
                                  <span>Watch</span>
                                </div>
                              )}
                              <span className="stream-thumb-live">LIVE</span>
                            </div>
                            <span className="stream-thumb-name">{name}{isSelf ? ' (you)' : ''}</span>
                          </button>
                          {isJoined && !isSelf && (
                            <button type="button" className="stream-thumb-leave" onClick={() => {
                              if (viewingScreen === sid) setViewingScreen(null)
                              leaveStream(sid)
                            }}>
                              <MonitorOff size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <div className={`voice-grid count-${peers.length + 1}`}>
            <div
              className={`voice-peer clickable speaking-${speaking[socketId] ? 'active' : 'idle'}`}
              onClick={(e) => onUserClick?.({ user: nickname, x: e.clientX + 10, y: e.clientY - 100 })}
              onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, nickname) }}
            >
              <div className="voice-avatar" style={getAvatar(nickname) ? {} : { background: selfColor }}>
                {getAvatar(nickname) ? <img src={getAvatar(nickname)} alt="" /> : nickname[0]?.toUpperCase()}
              </div>
                <div className="voice-user-badge">
                  <span className="voice-name">{nickname} (you)</span>
                  {isScreenSharing && <Monitor size={16} className="voice-status-icon-inline screen" />}
                  {isMuted && !isDeafened && <MicOff size={16} className="voice-status-icon-inline" />}
                  {isDeafened && <Headphones size={16} className="voice-status-icon-inline deafened" />}
                </div>
            </div>

            {peers.map((p) => (
              <div
                key={p.socketId}
                className={`voice-peer clickable speaking-${speaking[p.socketId] ? 'active' : 'idle'}`}
                onClick={(e) => onUserClick?.({ user: p.nickname, x: e.clientX + 10, y: e.clientY - 100 })}
                onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, p.nickname) }}
              >
                <div className="voice-avatar" style={getAvatar(p.nickname) ? {} : { background: getColor(p.nickname) }}>
                  {getAvatar(p.nickname) ? <img src={getAvatar(p.nickname)} alt="" /> : p.nickname[0]?.toUpperCase()}
                </div>
                <div className="voice-user-badge">
                  <span className="voice-name">{p.nickname}</span>
                  {screenPresenters[p.socketId] && <Monitor size={16} className="voice-status-icon-inline screen" />}
                  {peerMuted[p.socketId] && !peerDeafened[p.socketId] && <MicOff size={16} className="voice-status-icon-inline" />}
                  {peerDeafened[p.socketId] && <Headphones size={16} className="voice-status-icon-inline deafened" />}
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {!isActive && (
          <div className="voice-idle-hero">
            <div className="voice-idle-icon-ring">
              <Radio size={40} className="voice-idle-icon" />
            </div>
            <h2 className="voice-idle-title">{channel.name}</h2>
            {hasUsers ? (
              <>
                <div className="voice-grid-channel">
                  {channelUsers.map((name, i) => {
                    const st = voiceStates[name]
                    return (
                      <div
                        key={`${name}-${i}`}
                        className="voice-peer-observer clickable"
                        onClick={(e) => onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 })}
                        onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, name) }}
                      >
                        <div className="voice-avatar-sm" style={getAvatar(name) ? {} : { background: getColor(name) }}>
                          {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
                        </div>
                        <span className="voice-name-sm">{name}</span>
                        {st?.muted && !st?.deafened && <MicOff size={14} className="voice-user-status muted" />}
                        {st?.deafened && <Headphones size={14} className="voice-user-status deafened" />}
                        {st?.screenSharing && <Monitor size={14} className="voice-user-status screen" />}
                      </div>
                    )
                  })}
                </div>
                <button className="voice-join-hero-btn" onClick={() => joinVoice(channel)}>
                  <Volume2 size={18} />
                  <span>Join Voice</span>
                </button>
              </>
            ) : (
              <>
                <p className="voice-idle-subtitle">No one is in this voice channel yet — be the first to join!</p>
                <button className="voice-join-hero-btn" onClick={() => joinVoice(channel)}>
                  <Volume2 size={18} />
                  <span>Join Voice</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="voice-controls">
        {!isActive ? null : (
          <div className="voice-toolbar">
            <div className="voice-connected-info">
              <span className="voice-connected-label">Voice Connected</span>
            </div>
            <div className="voice-toolbar-actions">
              <button className={`voice-tool-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button className={`voice-tool-btn deafen ${isDeafened ? 'active' : ''}`} onClick={toggleDeafen} title={isDeafened ? 'Undeafen' : 'Deafen'}>
                <Headphones size={18} />
              </button>
              {isScreenSharing ? (
                <button className="voice-tool-btn screen-share active" onClick={stopScreenShare} title="Stop Sharing">
                  <MonitorOff size={18} />
                </button>
              ) : (
                <div className="stream-menu-wrap" ref={streamMenuRef}>
                  <button className="voice-tool-btn" onClick={() => setShowStreamMenu(v => !v)} title="Share Screen">
                    <Monitor size={18} />
                  </button>
                  {showStreamMenu && (
                      <div className="stream-menu">
                        <div className="stream-menu-title">Resolution</div>
                        {['source', '1080p', '720p', '480p'].map(r => (
                          <button key={r} className={streamRes === r ? 'active' : ''} onClick={() => { setStreamRes(r); localStorage.setItem('stream-res', r) }}>
                            {r === 'source' ? 'Source' : r}
                          </button>
                        ))}
                        <div className="stream-menu-title" style={{ marginTop: 4 }}>Frame Rate</div>
                        {['30', '60'].map(f => (
                          <button key={f} className={streamFps === f ? 'active' : ''} onClick={() => { setStreamFps(f); localStorage.setItem('stream-fps', f) }}>
                            {f}fps
                          </button>
                        ))}
                        <div className="stream-menu-divider" />
                        <label className="stream-menu-check">
                          <input type="checkbox" checked={streamAudio} onChange={(e) => { setStreamAudio(e.target.checked); localStorage.setItem('stream-audio', e.target.checked) }} />
                          <span>Share Audio</span>
                        </label>
                        <div className="stream-menu-divider" />
                        <button className="stream-menu-start" onClick={() => { startScreenShare(`${streamRes}${streamFps}`, streamAudio); setShowStreamMenu(false) }}>
                          <Monitor size={14} /> Go Live
                        </button>
                      </div>
                  )}
                </div>
              )}
              <button className="voice-tool-btn disconnect" onClick={leaveVoice} title="Disconnect">
                <PhoneOff size={18} />
              </button>
            </div>
            <div className="voice-ping-info">
              {ping !== null && (
                <button className="voice-tool-btn ping-btn" onClick={() => setShowDetails(true)} title="Connection Details">
                  <SignalBars ping={ping} />
                  <span className="ping-text">{ping} ms</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {showDetails && <ConnectionDetailsModal onClose={() => setShowDetails(false)} />}
      {streamCtx && (
        <StreamContextMenu
          sid={streamCtx.sid}
          x={streamCtx.x}
          y={streamCtx.y}
          isSelf={streamCtx.sid === socketId}
          name={screenPresenters[streamCtx.sid]}
          isViewing={viewingScreen === streamCtx.sid}
          isJoined={joinedStreams.has(streamCtx.sid)}
          volume={streamVolumes[streamCtx.sid] || { level: 1, muted: false }}
          streamRes={streamRes}
          streamFps={streamFps}
          onSetVolume={(l) => setStreamVolume(streamCtx.sid, l)}
          onToggleMute={() => toggleStreamMute(streamCtx.sid)}
          onJoinStream={() => joinStream(streamCtx.sid)}
          onStopWatching={() => { if (viewingScreen === streamCtx.sid) setViewingScreen(null); if (streamCtx.sid !== socketId) leaveStream(streamCtx.sid) }}
          onStopStream={() => { stopScreenShare(); setViewingScreen(null) }}
          onFullscreen={() => openFullscreen(streamCtx.sid)}
          onChangeQuality={(res, fps) => {
            setStreamRes(res); setStreamFps(fps)
            localStorage.setItem('stream-res', res)
            localStorage.setItem('stream-fps', fps)
            applyStreamQuality(`${res}${fps}`)
          }}
          onClose={() => setStreamCtx(null)}
        />
      )}
      {fullscreenStream && screenStreams[fullscreenStream] && (
        <StreamPlayer
          ref={playerRef}
          stream={screenStreams[fullscreenStream]}
          name={screenPresenters[fullscreenStream]}
          volume={streamVolumes[fullscreenStream] || { level: 1, muted: false }}
          viewers={streamViewers[fullscreenStream] || []}
          getColor={getColor}
          getAvatar={getAvatar}
          onSetVolume={(l) => setStreamVolume(fullscreenStream, l)}
          onToggleMute={() => toggleStreamMute(fullscreenStream)}
          onClose={() => {
            document.exitFullscreen?.()
            if (fullscreenStream !== socketId) leaveStream(fullscreenStream)
            setViewingScreen(null)
            setFullscreenStream(null)
          }}
        />
      )}
    </div>
  )
}

function StreamContextMenu({ sid, x, y, isSelf, name, isViewing, isJoined, volume, streamRes, streamFps, onSetVolume, onToggleMute, onJoinStream, onStopWatching, onStopStream, onFullscreen, onChangeQuality, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [onClose])

  const menuX = Math.min(x, window.innerWidth - 230)
  const menuY = Math.min(y, window.innerHeight - 350)

  const presets = ['source', '1080p', '720p', '480p']
  const fpsOpts = ['30', '60']

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div className="context-menu stream-ctx-menu" ref={ref} style={{ left: menuX, top: menuY }} onClick={(e) => e.stopPropagation()}>
        <div className="stream-ctx-header">
          <Monitor size={14} />
          <span>{name}{isSelf ? ' (you)' : ''}</span>
          <span className="stream-ctx-live">LIVE</span>
        </div>
        <div className="context-sep" />
        {isSelf ? (
          <>
            <div className="context-item context-submenu-trigger">
              <Settings size={14} /> Stream Quality
              <span className="context-arrow">▸</span>
              <div className="context-submenu">
                <div className="stream-menu-title">Resolution</div>
                {presets.map(r => (
                  <button key={r} className={`context-item${streamRes === r ? ' active' : ''}`} onClick={() => onChangeQuality(r, streamFps)}>
                    {r === 'source' ? 'Source' : r}
                  </button>
                ))}
                <div className="context-sep" />
                <div className="stream-menu-title">Frame Rate</div>
                {fpsOpts.map(f => (
                  <button key={f} className={`context-item${streamFps === f ? ' active' : ''}`} onClick={() => onChangeQuality(streamRes, f)}>
                    {f}fps
                  </button>
                ))}
              </div>
            </div>
            <div className="context-sep" />
            <button className="context-item danger" onClick={() => { onStopStream(); onClose() }}>
              <MonitorOff size={14} /> Stop Streaming
            </button>
          </>
        ) : (
          <>
            {!isJoined && (
              <button className="context-item" onClick={() => { onJoinStream(); onClose() }}>
                <Play size={14} /> Join Stream
              </button>
            )}
            {isJoined && (
              <div className="context-item stream-ctx-volume-row">
                {volume.muted ? <VolumeX size={14} /> : <Volume1 size={14} />}
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={volume.muted ? 0 : volume.level}
                  onChange={(e) => onSetVolume(parseFloat(e.target.value))}
                  className="stream-ctx-slider"
                />
                <button type="button" className="stream-ctx-mute-btn" onClick={onToggleMute} title={volume.muted ? 'Unmute' : 'Mute'}>
                  {volume.muted ? <VolumeX size={14} /> : <Volume1 size={14} />}
                </button>
              </div>
            )}
            {isJoined && (
              <>
                <button className="context-item" onClick={() => { onFullscreen?.(); onClose() }}>
                  <Maximize size={14} /> Fullscreen
                </button>
                <div className="context-sep" />
                <button className="context-item" onClick={() => { onStopWatching(); onClose() }}>
                  <MonitorOff size={14} /> Stop Watching
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const StreamPlayer = React.forwardRef(function StreamPlayer({ stream, name, volume, viewers, getColor, getAvatar, onSetVolume, onToggleMute, onClose }, ref) {
  const videoRef = useRef(null)
  const [showControls, setShowControls] = useState(true)
  const [isPlayPaused, setIsPlayPaused] = useState(false)
  const [fsViewers, setFsViewers] = useState(false)
  const hideTimer = useRef(null)

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream
    if (videoRef.current) videoRef.current.volume = volume.muted ? 0 : (volume.level ?? 1)
  }, [stream, volume])

  useEffect(() => {
    resetHideTimer()
    return () => clearTimeout(hideTimer.current)
  }, [resetHideTimer])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen?.(); return }
      if (e.key === 'm' || e.key === 'M') { onToggleMute(); return }
      if (e.key === ' ') { e.preventDefault(); setIsPlayPaused(p => { const next = !p; if (videoRef.current) next ? videoRef.current.pause() : videoRef.current.play(); return next }); return }
      if (e.key === 'ArrowUp') { onSetVolume(Math.min(1, (volume.level ?? 1) + 0.05)); return }
      if (e.key === 'ArrowDown') { onSetVolume(Math.max(0, (volume.level ?? 1) - 0.05)); return }
      resetHideTimer()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onToggleMute, onSetVolume, volume.level, resetHideTimer, ref])

  const volumePercent = Math.round((volume.muted ? 0 : (volume.level ?? 1)) * 100)

  return (
    <div
      ref={ref}
      className="stream-player"
      onMouseMove={resetHideTimer}
      onClick={() => { setIsPlayPaused(p => { const next = !p; if (videoRef.current) next ? videoRef.current.pause() : videoRef.current.play(); return next }); resetHideTimer() }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="stream-player-video"
      />
      {isPlayPaused && (
        <div className="stream-player-paused">
          <Play size={48} fill="currentColor" />
        </div>
      )}
      <div className={`stream-player-controls${showControls ? ' visible' : ''}`}>
        <div className="stream-player-bottom">
          <div className="stream-player-volume">
            <button type="button" className="stream-player-btn" onClick={(e) => { e.stopPropagation(); onToggleMute() }} title={volume.muted ? 'Unmute' : 'Mute'}>
              {volume.muted || volume.level === 0 ? <VolumeX size={18} /> : <Volume1 size={18} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.01"
              value={volume.muted ? 0 : (volume.level ?? 1)}
              onChange={(e) => { e.stopPropagation(); onSetVolume(parseFloat(e.target.value)) }}
              onClick={(e) => e.stopPropagation()}
              className="stream-player-slider"
            />
            <span className="stream-player-vol-label">{volumePercent}%</span>
          </div>
          <div className="stream-player-actions">
            <span className="stream-player-name">
              <Monitor size={14} /> {name}
              <span className="stream-player-live">LIVE</span>
            </span>
            <div className="stream-player-eye-wrap">
              <button type="button" className="stream-player-btn" onClick={(e) => { e.stopPropagation(); setFsViewers(v => !v) }} title="Viewers">
                <Eye size={16} /> <span>{viewers.length}</span>
              </button>
              {fsViewers && (
                <div className="stream-viewers-list" onClick={(e) => e.stopPropagation()}>
                  {viewers.length === 0 && <span className="stream-viewers-empty">No viewers yet</span>}
                  {viewers.map((v, i) => (
                    <div key={i} className="stream-viewer-item">
                      <div className="voice-avatar-sm" style={getAvatar(v) ? {} : { background: getColor(v) }}>
                        {getAvatar(v) ? <img src={getAvatar(v)} alt="" /> : v[0]?.toUpperCase()}
                      </div>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="stream-player-btn" onClick={(e) => { e.stopPropagation(); onClose() }} title="Leave Stream">
              <MonitorOff size={18} />
            </button>
            <button type="button" className="stream-player-btn" onClick={(e) => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen?.() }} title="Fullscreen">
              {document.fullscreenElement ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
