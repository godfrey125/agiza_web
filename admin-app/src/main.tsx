import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { MarketplaceAuthProvider } from './lib/marketplace-auth'
import { ConfirmProvider, ToastProvider } from './components/ui'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <MarketplaceAuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </MarketplaceAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
