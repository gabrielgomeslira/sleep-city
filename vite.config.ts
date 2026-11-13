import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The @opentelemetry/api copy that Faro's tracing depends on. The server pulls a newer API, which
 * npm hoists, so the browser's fetch instrumentation would pick it up and find no tracer (the API
 * ignores a provider registered by an older copy): no spans, no `traceparent` to the API.
 */
function faroOtelApi() {
  let dir = path.resolve(import.meta.dirname, 'node_modules/@grafana/faro-web-tracing')
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules/@opentelemetry/api')
    if (existsSync(candidate)) return candidate
    dir = path.dirname(dir)
  }
  throw new Error('@opentelemetry/api do Faro não encontrado')
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, 'src') },
      { find: '@shared', replacement: path.resolve(import.meta.dirname, 'shared') },
      { find: /^@opentelemetry\/api$/, replacement: faroOtelApi() },
    ],
  },
  server: {
    host: true,
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3001}` },
  },
})
