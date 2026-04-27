import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
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
