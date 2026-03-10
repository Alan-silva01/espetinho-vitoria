import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Proteção contra chunk stale do PWA: se um chunk dinâmico falhar ao carregar,
// limpa caches e recarrega a página automaticamente (evita tela branca)
window.addEventListener('error', (event) => {
  const msg = event.message || ''
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
    console.warn('[PWA] Chunk stale detectado — limpando cache e recarregando...')
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)))
    }
    window.location.reload()
  }
})

// Captura também reject de import() dinâmico (lazy)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason) || ''
  if (reason.includes('Failed to fetch dynamically imported module') || reason.includes('ChunkLoadError')) {
    console.warn('[PWA] Lazy import falhou — limpando cache e recarregando...')
    event.preventDefault()
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)))
    }
    window.location.reload()
  }
})

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (err) {
  console.error('[main] Erro fatal na inicialização:', err)
  document.getElementById('root').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;font-family:sans-serif">
      <div style="font-size:48px;margin-bottom:16px">😕</div>
      <h2>Ops! Algo deu errado</h2>
      <p style="color:#888">Tente recarregar a página.</p>
      <button onclick="window.location.reload()" style="background:#F97316;color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:16px;font-weight:600;cursor:pointer;margin-top:16px">🔄 Recarregar</button>
    </div>
  `
}
