import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './components/ThemeProvider'
import { installElectronApiShim } from './services/electronShim'
import './i18n'
import './index.css'

// Materialise the legacy `window.electronAPI` over the Management HTTP API
// so existing components keep working in the web build.
installElectronApiShim()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
