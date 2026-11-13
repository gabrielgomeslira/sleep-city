import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Only on the official domain (the one otel.gomes.dev accepts), or when a build sets VITE_FARO_URL.
const faroUrl =
  import.meta.env.VITE_FARO_URL ?? (location.origin === 'https://sleepcity.gomes.dev' ? 'https://otel.gomes.dev/faro' : '')
if (faroUrl) import('./lib/faro').then(({ startFaro }) => startFaro(faroUrl))
