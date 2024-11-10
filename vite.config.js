import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use different ports for different modes
  const port = mode === 'server1' ? 5173 : mode === 'server2' ? 5174 : 5173
  const serverUrl = mode === 'server1' ? 'http://localhost:3000' : 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      port,
    },
    define: {
      'process.env.SERVER_URL': JSON.stringify(serverUrl)
    }
  }
})
