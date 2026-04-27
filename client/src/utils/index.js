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

export const THEMES = {
  amoled: {
    label: 'AMOLED Black',
    vars: {
      '--bg-primary': '#0a0a0a',
      '--bg-secondary': '#000000',
      '--bg-tertiary': '#000000',
      '--bg-input': '#1a1a1a',
      '--bg-hover': '#1a1a1a',
      '--bg-active': '#2a2a2a',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#a0a0a0',
      '--text-muted': '#707070',
      '--accent': '#6ae7c3',
      '--accent-hover': '#4dd4a8',
      '--accent-glow': 'rgba(106,231,195,0.25)',
      '--red': '#ed4245',
      '--green': '#23a559',
      '--yellow': '#f0b232',
      '--border': '#1e1e1e',
      '--border-color': 'rgba(255,255,255,0.06)',
    }
  },
  light: {
    label: 'Light',
    vars: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f2f3f5',
      '--bg-tertiary': '#e3e5e8',
      '--bg-input': '#ebedef',
      '--bg-hover': '#e8e9eb',
      '--bg-active': '#d4d6d9',
      '--text-primary': '#0e0e10',
      '--text-secondary': '#4e5058',
      '--text-muted': '#6d6f78',
      '--accent': '#6ae7c3',
      '--accent-hover': '#4dd4a8',
      '--accent-glow': 'rgba(106,231,195,0.25)',
      '--red': '#d83c3e',
      '--green': '#1a7d3f',
      '--yellow': '#c49a2a',
      '--border': '#d4d6d9',
      '--border-color': 'rgba(0,0,0,0.1)',
    }
  },
  discord: {
    label: 'thiscord?',
    vars: {
      '--bg-primary': '#313338',
      '--bg-secondary': '#2b2d31',
      '--bg-tertiary': '#1e1f22',
      '--bg-input': '#383a40',
      '--bg-hover': '#35373c',
      '--bg-active': '#404249',
      '--text-primary': '#f2f3f5',
      '--text-secondary': '#b5bac1',
      '--text-muted': '#949ba4',
      '--accent': '#6ae7c3',
      '--accent-hover': '#4dd4a8',
      '--accent-glow': 'rgba(106,231,195,0.25)',
      '--red': '#ed4245',
      '--green': '#23a559',
      '--yellow': '#f0b232',
      '--border': '#3f4147',
      '--border-color': 'rgba(255,255,255,0.06)',
    }
  },
}

export const THEME_VARS = [
  { key: '--bg-primary', label: 'Background' },
  { key: '--bg-secondary', label: 'Secondary Background' },
  { key: '--bg-tertiary', label: 'Tertiary Background' },
  { key: '--bg-input', label: 'Input Background' },
  { key: '--bg-hover', label: 'Hover Background' },
  { key: '--text-primary', label: 'Primary Text' },
  { key: '--text-secondary', label: 'Secondary Text' },
  { key: '--text-muted', label: 'Muted Text' },
  { key: '--accent', label: 'Accent' },
  { key: '--accent-hover', label: 'Accent Hover' },
  { key: '--border', label: 'Border' },
  { key: '--red', label: 'Red' },
  { key: '--green', label: 'Green' },
]

export function applyTheme(themeName, customVars) {
  const root = document.documentElement
  const preset = THEMES[themeName]

  if (themeName === 'custom' && customVars) {
    for (const [k, v] of Object.entries(customVars)) {
      root.style.setProperty(k, v)
    }
    return
  }

  for (const [k, v] of Object.entries(preset?.vars || THEMES.amoled.vars)) {
    root.style.setProperty(k, v)
  }
}
