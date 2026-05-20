import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import { ThemeProvider } from './hooks/useTheme.jsx'
import App from './App.jsx'
import MobileApp from './MobileApp.jsx'
import './styles/global.css'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
}

const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768

function Root() {
  const [mobile, setMobile] = useState(isMobileDevice)
  useEffect(() => {
    let timer
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setMobile(isMobileDevice()), 150)
    }
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      clearTimeout(timer)
    }
  }, [])
  return mobile ? <MobileApp /> : <App />
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)
