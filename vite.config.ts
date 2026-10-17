import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (command === 'build' && env.VITE_DATA_MODE === 'demo') {
    throw new Error('Los datos de demostración se usan con npm run dev. El build utiliza la API.');
  }
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5176,
      strictPort: true,
      proxy: {
        '/api/admin': { target: env.ADMIN_API_PROXY_TARGET || 'http://127.0.0.1:8001' },
      },
    },
    preview: { host: '127.0.0.1', port: 4176, strictPort: true },
  };
});
