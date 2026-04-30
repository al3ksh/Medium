let audioCtx = null

function getVolume() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    return (s?.soundVolume ?? 50) / 100
  } catch {
    return 0.15
  }
}

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function playTone(freqStart, freqEnd, duration, type = 'sine') {
  try {
    const ctx = getCtx()
    const vol = getVolume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}

export function playNotifSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.messageSound ?? true)) return
  } catch {}
  playTone(880, 1100, 0.25)
}

export function playVoiceJoinSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.voiceJoinSound ?? true)) return
  } catch {}
  playTone(400, 700, 0.12)
  setTimeout(() => playTone(700, 900, 0.1), 80)
}

export function playVoiceLeaveSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.voiceJoinSound ?? true)) return
  } catch {}
  playTone(700, 400, 0.15)
}

export function playMuteSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.muteSound ?? true)) return
  } catch {}
  playTone(500, 380, 0.06)
}

export function playUnmuteSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.muteSound ?? true)) return
  } catch {}
  playTone(380, 500, 0.06)
}

export function playDeafenSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.muteSound ?? true)) return
  } catch {}
  playTone(500, 300, 0.08)
}

export function playUndeafenSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.muteSound ?? true)) return
  } catch {}
  playTone(300, 500, 0.06)
  setTimeout(() => playTone(500, 650, 0.06), 50)
}

export function playStreamStartSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.voiceJoinSound ?? true)) return
  } catch {}
  playTone(600, 900, 0.1)
  setTimeout(() => playTone(900, 1200, 0.12), 90)
}

export function playStreamStopSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.voiceJoinSound ?? true)) return
  } catch {}
  playTone(900, 600, 0.12)
}

export function playPeerJoinSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.voiceJoinSound ?? true)) return
  } catch {}
  playTone(440, 660, 0.08)
}

export function playPeerLeaveSound() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    if (!(s?.voiceJoinSound ?? true)) return
  } catch {}
  playTone(660, 440, 0.08)
}
