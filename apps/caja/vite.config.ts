import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// App de caja: PWA instalable en la tablet. La lógica de cacheo offline
// (guardar ventas y stock localmente) se configura en el Paso 5.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Central de Cobros - Caja',
        short_name: 'Caja',
        description: 'Punto de venta para verdulerías - Central de Cobros',
        theme_color: '#1b7a3d',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
