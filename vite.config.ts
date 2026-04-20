import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function toFsPath(url: URL) {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:\/)/, '$1'))
}

const srcDir = toFsPath(new URL('./src/', import.meta.url))
const assetsDir = toFsPath(new URL('./src/assets/', import.meta.url))

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return toFsPath(new URL(filename, `file:///${assetsDir.replace(/\\/g, '/')}`))
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': srcDir,
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-motion': ['motion/react'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
