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
              // pdfjs 通过动态 import() 加载，不强制合并，让 Vite 自动拆分为独立 chunk
              if (id.includes('katex')) return 'katex';
              // @sentry/react 的路径含 "/react/"，若不排除会被吸进首屏预载的
              // react-vendor（线上实测让其从 ~200KB 涨到 664KB raw），抵消
              // main.tsx 的空闲延迟加载——返回 undefined 让它随动态 chunk 自然拆分
              if (id.includes('@sentry')) return undefined;
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
