import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { initI18n } from './i18n'
import './index.css'
import { router } from './router'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element in index.html')

await initI18n()

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
