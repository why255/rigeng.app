/// <reference types="vite/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import { MobileApp } from './App'
import '@rigeng/shared/styles/tokens.css'
import '@rigeng/shared/styles/reset.css'
import '@rigeng/shared/styles/global.css'
import '@rigeng/shared/components/primitives/primitives.css'
import '@rigeng/shared/components/chat/chat.css'
import '@rigeng/shared/components/business/business.css'
import './components/layout/layout.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>,
)
