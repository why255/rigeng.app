/// <reference types="vite/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import { MobileApp } from './App'
import { clearLegacyMorningPlanStorage } from '@rigeng/shared/utils/clearLegacyStorage'
import '@rigeng/shared/styles/tokens.css'
import '@rigeng/shared/styles/reset.css'
import '@rigeng/shared/styles/global.css'
import '@rigeng/shared/components/primitives/primitives.css'
import '@rigeng/shared/components/chat/chat.css'
import '@rigeng/shared/components/business/business.css'
import './components/layout/layout.css'

// 清除旧版 HTML localStorage 键值（morning_plans, careMode, voiceMode, offlineModeEnabled）
clearLegacyMorningPlanStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>,
)
