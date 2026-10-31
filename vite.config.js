import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Employee Hub nie używa PostCSS ani Tailwinda (od v16.1 jeden arkusz atmosphere-hub.css na tokenach).
// `css.postcss: {}` wyłącza szukanie postcss.config.js — build nie wywróci się, gdy w repozytorium zostanie stary plik konfiguracyjny
// (tak było przy wdrożeniu na Vercel 31.10: „Add files via upload” zostawiło postcss.config.js bez zainstalowanych pakietów).
export default defineConfig({ plugins: [react()], css: { postcss: {} } })
