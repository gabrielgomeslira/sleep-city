import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'

/**
 * Browser telemetry (JS errors, Web Vitals, sessions and a trace for each API call, continued
 * by the server), sent to Grafana through otel.gomes.dev. Loaded by main.tsx after the first render.
 */
export function startFaro(url: string) {
  initializeFaro({
    url,
    app: {
      name: 'web',
      namespace: 'sleep-city',
      version: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      environment: import.meta.env.VITE_VERCEL_ENV ?? import.meta.env.MODE,
    },
    // The room polling (every 2.5 s) would be most of the data; the API samples it on its side.
    ignoreUrls: [/\/api\/rooms\/[A-Za-z0-9]+$/],
    instrumentations: [...getWebInstrumentations(), new TracingInstrumentation()],
  })
}
