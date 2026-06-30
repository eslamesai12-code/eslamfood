import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  // تحديد المسار الأساسي لضمان عمل الروابط بشكل صحيح على Vercel
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // تعيين @ ليشير إلى مجلد src بشكل صحيح
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // لضمان عدم مسح ملفات السيرفر التي قد تُبنى بشكل متوازي
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
