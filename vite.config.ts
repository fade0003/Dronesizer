/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` produces one self-contained, offline-capable
// index.html (everything inlined) in dist-single/.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'singlefile' ? [viteSingleFile()] : []),
  ],
  build:
    mode === 'singlefile'
      ? { outDir: 'dist-single', emptyOutDir: true }
      : undefined,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
