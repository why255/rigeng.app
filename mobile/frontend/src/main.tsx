/// <reference types="vite/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import { MobileApp } from './App'
import { clearLegacyMorningPlanStorage } from '@/shared/utils/clearLegacyStorage'
import '@/shared/styles/tokens.css'
import '@/shared/styles/reset.css'
import '@/shared/styles/global.css'
import '@/shared/components/primitives/primitives.css'
import '@/shared/components/chat/chat.css'
import '@/shared/components/business/business.css'
import './components/layout/layout.css'

// 清除旧版 HTML localStorage 键值
clearLegacyMorningPlanStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>,
)
