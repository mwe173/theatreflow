import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')
  
  console.log('🔧 Vite Config - Mode:', mode)
  console.log('🔧 VITE_SUPABASE_URL exists?', !!env.VITE_SUPABASE_URL)
  
  return {
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
    },
    // Ensure env variables are available
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    }
  }
})