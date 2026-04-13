import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/story-json-creator/',
  plugins: [react()],
  build: {
    outDir: 'dist-web',
  },
})
