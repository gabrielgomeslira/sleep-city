import { app } from './app.js'

try {
  process.loadEnvFile('.env')
} catch {
  // .env is optional locally; without Redis the in-memory store is used.
}

const port = Number(process.env.API_PORT ?? 3001)
app.listen(port, () => console.log(`API rodando em http://localhost:${port}`))
