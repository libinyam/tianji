import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'motion': ['motion/react'],
            'cloudbase': ['@cloudbase/js-sdk'],
            'katex': ['katex'],
            'pdfjs': ['pdfjs-dist'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ['@cloudbase/js-sdk'],
    },
    plugins: [
      react({
        babel: {
          plugins: [
            // 仅开发环境启用组件定位器，避免生产构建泄露源码路径
            ...(isDev ? ['react-dev-locator'] : []),
          ],
        },
      }),
      tsconfigPaths()
    ],
  }
})
