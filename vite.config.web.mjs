import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/story-json-creator/',
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    // Do NOT inline fonts for web — keep them as separate files so the initial
    // CSS stays small (~50KB) and fonts load lazily over HTTP.
    // (The desktop build uses assetsInlineLimit:500000 to work around ASAR file-URL issues,
    //  but that's not needed for GitHub Pages.)
    assetsInlineLimit: 10240, // 10KB — only tiny icons/svgs get inlined
  },
})
