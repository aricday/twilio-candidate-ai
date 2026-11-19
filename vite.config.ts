import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const server = `http://localhost:${process.env.PORT ?? 3001}`;

// The browser uses http://localhost:5173 (a secure context, so the mic works without https).
// Twilio reaches the Express server directly through ngrok on port 3001.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/ws/ui': { target: server.replace('http', 'ws'), ws: true },
    },
  },
});
