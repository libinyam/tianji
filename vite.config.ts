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
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@cloudbase/js-sdk')) return 'cloudbase';
              if (id.includes('pdfjs-dist')) return 'pdfjs';
              if (id.includes('katex')) return 'katex';
              if (id.includes('motion')) return 'motion';
              if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
            }
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
