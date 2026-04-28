import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost-cert.pem'),
    },
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': apiUrl,
      '/socket.io': {
        target: apiUrl,
        ws: true,
      },
      '/uploads': apiUrl,
    },
  },
})
