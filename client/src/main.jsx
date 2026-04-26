import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { loadSettings, applyTheme } from './utils'
import './styles/index.css'

const s = loadSettings()
applyTheme(s.theme || 'dark', s.customTheme)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
