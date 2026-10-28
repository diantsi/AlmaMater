import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks only to the frontend origin; /api is proxied to the backend service (ADR-005, ADR-006)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Bind-mounted sources on Windows/macOS hosts do not emit file events reliably
    watch: { usePolling: true },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
});
