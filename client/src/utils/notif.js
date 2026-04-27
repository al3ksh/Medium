let audioCtx = null

function getVolume() {
  try {
    const s = JSON.parse(localStorage.getItem('medium-settings'))
    return (s?.soundVolume ?? 50) / 100
  } catch {
    return 0.15
  }
}

export function playNotifSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const vol = getVolume()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08)
    gain.gain.setValueAtTime(vol, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.25)
  } catch {}
}
