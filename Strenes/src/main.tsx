import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The service worker uses skipWaiting/clientsClaim, so when an update
// activates it takes control of this page — reload once so the user sees
// the new version immediately instead of the stale precache.
if ('serviceWorker' in navigator) {
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
