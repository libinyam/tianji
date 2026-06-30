import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            // React 核心
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // 动画
            'motion': ['motion/react'],
            // CloudBase SDK
            'cloudbase': ['@cloudbase/js-sdk'],
            // KaTeX 数学公式（已按需加载，但进一步拆分字体相关）
            'katex': ['katex'],
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
