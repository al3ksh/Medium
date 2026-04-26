const COLORS = [
  '#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
  '#f47b67', '#e8a23e', '#3ba55c', '#2d7d46', '#0d7dcd',
  '#9b59b6', '#e91e63', '#00bcd4', '#ff9800', '#795548',
]

export function nicknameToColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('medium-settings')) || {}
  } catch {
    return {}
  }
}

export function saveSettings(settings) {
  localStorage.setItem('medium-settings', JSON.stringify(settings))
}
