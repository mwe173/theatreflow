// vite.config.js
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        people: resolve(__dirname, 'people.html'),
        attendance: resolve(__dirname, 'attendance.html'),
        calendar: resolve(__dirname, 'calendar.html'),
        props: resolve(__dirname, 'props-costumes.html'),
        files: resolve(__dirname, 'files.html'),
        settings: resolve(__dirname, 'settings.html'),
        scenes: resolve(__dirname, 'scenes.html')
      }
    }
  }
})