import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './App'
import { ensureSettings } from './db/db'
import { setupPwaUpdater } from './pwa/updater'
import { setupKeyboardHandling } from './lib/keyboard'

void ensureSettings()
setupPwaUpdater()
setupKeyboardHandling()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
