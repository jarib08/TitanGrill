import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    allowedHosts: true
  },
  build: {
    // Hide sourcemaps in production for security
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Core React libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charting library
          'vendor-charts': ['recharts'],
          // Animation library
          'vendor-motion': ['framer-motion'],
          // C4: antes esto era un solo chunk 'vendor-qr' de ~352 KB que la
          // landing publica descargaba completo, incluyendo html5-qrcode (el
          // escaner de camara) que SOLO usa el POS. Separado en dos:
          // generadores de QR (livianos, los usa la tarjeta de fidelizacion)
          // y escaner (pesado, solo POS).
          'vendor-qr': ['qrcode.react', 'react-qr-code'],
          'vendor-qr-scanner': ['html5-qrcode']
        }
      }
    },
    // Minification options
    minify: 'esbuild',
  },
  // B4: esto estaba dentro de `build`, donde Vite lo ignora sin avisar
  // (`esbuild` es opcion de nivel raiz en UserConfig, no de BuildEnvironmentOptions).
  // Resultado: los console.log SI llegaban a produccion, incluyendo datos de
  // clientes y payloads de QR escaneados.
  esbuild: {
    drop: ['console', 'debugger'],
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js']
  }
})
