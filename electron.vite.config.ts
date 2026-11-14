import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const alias = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias },
    // youtubei.js is ESM-only; bundle it so the CJS main bundle has no ESM require.
    build: { externalizeDeps: { exclude: ['youtubei.js'] } }
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          engine: resolve(__dirname, 'src/preload/engine.ts')
        }
      }
    }
  },
  renderer: {
    resolve: { alias },
    plugins: [react()],
    server: { port: 5173, strictPort: true }
  }
})
