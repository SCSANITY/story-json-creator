import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/story-json-creator/',
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    // Inline fonts ≤500KB as base64 — same as desktop build, avoids font-path issues on GH Pages
    assetsInlineLimit: 500000,
  },
})
