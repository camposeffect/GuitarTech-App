import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',  // Certifique-se de que a pasta de saída é "dist"
    rollupOptions: {
      input: {
        main: './index.html', // Certifique-se de que o entry point é o seu index.html
      },
    },
  },
})
