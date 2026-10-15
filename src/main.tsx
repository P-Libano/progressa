import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'
import { PwaUpdater } from './components/PwaUpdater'
import './index.css'
import { applyTheme } from './lib/theme'

applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
      <PwaUpdater />
    </HashRouter>
  </StrictMode>,
)
