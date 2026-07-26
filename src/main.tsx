import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// #424 Sentry 延迟加载：@sentry/react + browserTracingIntegration 原先静态打进
// 入口 chunk，在业务代码前下载解析。改为空闲时动态 import；初始化前的错误用
// 队列暂存，Sentry 就绪后统一补报，监控无损但首屏更快。
type QueuedError = { error: unknown; isRejection: boolean }
const earlyErrors: QueuedError[] = []
const onEarlyError = (e: ErrorEvent) => earlyErrors.push({ error: e.error ?? e.message, isRejection: false })
const onEarlyRejection = (e: PromiseRejectionEvent) => earlyErrors.push({ error: e.reason, isRejection: true })
window.addEventListener('error', onEarlyError)
window.addEventListener('unhandledrejection', onEarlyRejection)

const loadSentry = () => {
  void import('./lib/sentry').then(({ initSentry, Sentry }) => {
    initSentry()
    window.removeEventListener('error', onEarlyError)
    window.removeEventListener('unhandledrejection', onEarlyRejection)
    for (const { error } of earlyErrors) {
      Sentry.captureException(error)
    }
    earlyErrors.length = 0
  })
}
if ('requestIdleCallback' in window) {
  requestIdleCallback(loadSentry, { timeout: 5000 })
} else {
  setTimeout(loadSentry, 3000)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
