import { useState, useMemo, useEffect } from 'react'
import { X, Lock } from 'lucide-react'
import { useVoice } from '../contexts/VoiceContext'

export default function ConnectionDetailsModal({ onClose }) {
  const { pingHistory, ping, packetLoss } = useVoice()
  const [activeTab, setActiveTab] = useState('connection')

  const avgPing = useMemo(() => {
    if (!pingHistory || pingHistory.length === 0) return 0
    const sum = pingHistory.reduce((acc, curr) => acc + curr.ping, 0)
    return Math.round(sum / pingHistory.length)
  }, [pingHistory])

  // Chart data calculation
  // Find max ping to scale the Y-axis. Default min scale is 50ms.
  const chartMaxY = Math.max(50, ...(pingHistory?.map(p => p.ping) || []))
  
  const generatePath = () => {
    if (!pingHistory || pingHistory.length < 2) return ''
    
    // We draw across a 100x40 coordinate system
    const width = 100
    const height = 40
    
    return pingHistory.map((point, i) => {
      // X maps from 0 to 100 (from oldest to newest)
      const x = (i / (pingHistory.length - 1)) * width
      // Y maps from 0 to 40 (0 is max ping, 40 is 0 ping)
      const y = height - (Math.min(point.ping, chartMaxY) / chartMaxY) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }

  // Generate ticks for Y axis
  const middleY = chartMaxY / 2

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="connection-modal-overlay" onClick={onClose}>
      <div className="connection-modal-content" onClick={e => e.stopPropagation()}>
        <div className="connection-modal-header">
          <h2>Voice Connection Details</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="connection-tabs">
          <button 
            className={`tab-btn ${activeTab === 'connection' ? 'active' : ''}`}
            onClick={() => setActiveTab('connection')}
          >
            Connection
          </button>
          <button 
            className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy
          </button>
        </div>

        {activeTab === 'connection' && (
          <div className="connection-tab-content">
            <div className="chart-container">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="ping-chart">
                {/* Horizontal grid lines */}
                <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                <line x1="0" y1="40" x2="100" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                
                {pingHistory?.length > 1 && (
                  <path 
                    d={generatePath()} 
                    fill="none" 
                    stroke="var(--accent)" 
                    strokeWidth="1.5" 
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              <div className="chart-y-axis">
                <span>{Math.round(chartMaxY)}</span>
                <span>{Math.round(middleY)}</span>
                <span>0</span>
              </div>
            </div>

            <div className="connection-stats">
              <div className="stat-row">
                <span className="stat-label">Server</span>
                <span className="stat-value">Poland</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Average ping</span>
                <span className="stat-value">{avgPing} ms</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Latest ping</span>
                <span className="stat-value">{ping ?? 0} ms</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Packet loss</span>
                <span className="stat-value">{packetLoss}%</span>
              </div>
            </div>

            <p className="connection-warning">
               With a ping of 250 ms or higher, you may experience noticeable audio delay. If packet loss consistently stays above 10%, you might sound like a robot. If the problem persists, try disconnecting and reconnecting.
            </p>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="connection-tab-content">
            <p className="connection-warning">
               Voice and video calls are standardly protected. Your data remains private and secure, giving you peace of mind during conversations.
            </p>
          </div>
        )}

        <div className="connection-modal-footer">
          <div className="footer-secure">
            <Lock size={14} className="icon-green" />
            <div className="secure-text">
              <span>End-to-end</span>
              <span>encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
