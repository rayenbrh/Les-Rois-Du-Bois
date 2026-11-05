import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  const config = {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Build output to ../dist (root level)
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };

  if (isDev) {
    config.server = {
      port: 3000,
      host: true, // Important: allows access from external hosts/domains
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        'les-rois-du-bois-frontend.2bj94x.easypanel.host',
        'lesroisdubois.com',
        // Optional: allow all EasyPanel subdomains (useful if the subdomain changes)
        // '.easypanel.host',
      ],
      proxy: {
        '/api': {
          target: 'https://les-rois-du-bois-back.2bj94x.easypanel.host/',
          changeOrigin: true,
        },
        // Proxy uploads in development so that frontend can use relative /uploads URLs
        '/uploads': {
          target: 'https://les-rois-du-bois-back.2bj94x.easypanel.host/',
          changeOrigin: true,
        },
      },
    };
  }

  return config;
});
