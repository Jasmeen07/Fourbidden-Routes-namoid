import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NamoIDProvider } from '@namoidhq/react'
import './index.css'
import App from './App.tsx'

const clientId = import.meta.env.VITE_NAMOID_CLIENT_ID || 'test_client_id';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NamoIDProvider clientId={clientId}>
      <App />
    </NamoIDProvider>
  </StrictMode>,
)

