import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 500000, // inline fonts as base64 up to 500KB — avoids Electron ASAR file-URL issues
  },
})
