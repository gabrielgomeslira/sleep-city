/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Faro collector for a test build; without it, telemetry only runs on the official domain. */
  readonly VITE_FARO_URL?: string
  /** Exposed by Vercel at build time. */
  readonly VITE_VERCEL_ENV?: string
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string
}
