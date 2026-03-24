import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
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
        },
        // Make sure external modules are bundled
        external: []
      },
      // Ensure modules are bundled, not left as external
      commonjsOptions: {
        include: [/node_modules/]
      }
    },
    optimizeDeps: {
      include: ['@supabase/supabase-js']
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
    }
  }
})