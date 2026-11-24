// Genie 2.3 release (2026-11-24): see PR #30.
import React from 'react'
import ReactDOM from 'react-dom/client'
import LegacyApp from './LegacyApp.jsx'

// Explicit operator-controlled deployment flag in /config.js.
// Do not accept URL parameters, local storage, cookies, or visitor preferences
// as an override. The verified existing chatbot is always the default.
const genieEnabled = window.AIG_CONFIG?.genieV2Enabled === true
const GenieV2App = React.lazy(() => import('./App.jsx'))
const ChosenApp = genieEnabled ? GenieV2App : LegacyApp

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      <ChosenApp />
    </React.Suspense>
  </React.StrictMode>
)
