// OpenTelemetry: traces and logs sent to the observability platform (otel.gomes.dev).
// Only on when OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise everything here is a no-op.
import {
  SeverityNumber,
  SpanKind,
  SpanStatusCode,
  context,
  logs,
  propagation,
  trace,
  type Attributes,
} from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { BatchSpanProcessor, TracerProvider, type ReadableSpan, type SpanProcessor } from '@opentelemetry/sdk-trace'
import { waitUntil } from '@vercel/functions'
import type { NextFunction, Request, Response } from 'express'

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '')
export const telemetryEnabled = !!endpoint

/** Read-only GETs (the 2.5 s polling) are sampled; errors and slow requests are always kept. */
const POLL_SAMPLE_RATE = 0.1
const SLOW_MS = 1000
/** Sampling rate kept on the span; Tempo multiplies request counts by 1/rate, so totals still add up. */
const RATIO_ATTR = 'sampling.ratio'
const DROP_ATTR = 'sampling.drop'

/** "k=v,k2=v2", the format of OTEL_EXPORTER_OTLP_HEADERS. */
function parseHeaders(value = ''): Record<string, string> {
  return Object.fromEntries(
    value
      .split(',')
      .map((pair) => pair.split('='))
      .filter(([k, v]) => k && v)
      .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join('=').trim())]),
  )
}

/**
 * Holds each request's spans until its server span ends, then forwards or drops the whole trace.
 * Dropping only children would leave orphan spans; dropping the root alone would break the trace.
 */
class RequestSampler implements SpanProcessor {
  private pending = new Map<string, ReadableSpan[]>()

  constructor(private next: SpanProcessor) {}

  onStart(...args: Parameters<SpanProcessor['onStart']>) {
    this.next.onStart(...args)
  }

  onEnd(span: ReadableSpan) {
    const traceId = span.spanContext().traceId
    const spans = this.pending.get(traceId) ?? []
    if (span.kind !== SpanKind.SERVER) {
      // A frozen function can leave traces unfinished; don't let them pile up.
      if (this.pending.size > 500) this.pending.clear()
      this.pending.set(traceId, [...spans, span])
      return
    }
    this.pending.delete(traceId)
    if (span.attributes[DROP_ATTR]) return
    for (const s of [...spans, span]) this.next.onEnd(s)
  }

  forceFlush() {
    return this.next.forceFlush()
  }

  shutdown() {
    return this.next.shutdown()
  }
}

let tracerProvider: TracerProvider | undefined
let loggerProvider: LoggerProvider | undefined

if (endpoint) {
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
  const resource = resourceFromAttributes({
    'service.name': 'api',
    'service.namespace': 'sleep-city',
    'service.version': process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    'deployment.environment': process.env.VERCEL_ENV ?? 'development',
    'cloud.region': process.env.VERCEL_REGION ?? 'local',
  })

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces`, headers })
  const logExporter = new OTLPLogExporter({ url: `${endpoint}/v1/logs`, headers })
  tracerProvider = new TracerProvider({
    resource,
    spanProcessors: [new RequestSampler(new BatchSpanProcessor({ exporter: traceExporter }))],
  })
  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor({ exporter: logExporter })],
  })

  context.setGlobalContextManager(new AsyncLocalStorageContextManager())
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  trace.setGlobalTracerProvider(tracerProvider)
  logs.setGlobalLoggerProvider(loggerProvider)
}

const tracer = trace.getTracer('sleep-city')
const logger = logs.getLogger('sleep-city')

/** Sends what is buffered without holding the response (Vercel keeps the function alive for it). */
function flush() {
  if (!tracerProvider || !loggerProvider) return
  waitUntil(Promise.all([tracerProvider.forceFlush(), loggerProvider.forceFlush()]).catch(() => {}))
}

const roomCodeIn = (path: string) => /^\/api\/rooms\/([A-Za-z0-9]+)/.exec(path)?.[1]?.toUpperCase()

/** One server span per request; continues the browser's trace when it sends `traceparent`. */
export function requestTracing(req: Request, res: Response, next: NextFunction) {
  if (!telemetryEnabled) return next()

  const parent = propagation.extract(context.active(), req.headers)
  const span = tracer.startSpan(
    req.method,
    {
      kind: SpanKind.SERVER,
      attributes: {
        'http.request.method': req.method,
        'url.path': req.path,
        'user_agent.original': req.get('user-agent') ?? '',
        ...(roomCodeIn(req.path) && { 'room.code': roomCodeIn(req.path) }),
      },
    },
    parent,
  )
  const started = performance.now()

  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    const route = req.route?.path as string | undefined
    const status = res.statusCode
    span.updateName(`${req.method} ${route ?? req.path}`)
    span.setAttributes({ 'http.response.status_code': status, ...(route && { 'http.route': route }) })
    if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR })

    const polling = req.method === 'GET'
    const healthy = status < 400 && performance.now() - started < SLOW_MS
    if (polling && healthy) {
      if (Math.random() < POLL_SAMPLE_RATE) span.setAttribute(RATIO_ATTR, POLL_SAMPLE_RATE)
      else span.setAttribute(DROP_ATTR, true)
    }
    span.end()
    flush()
  }
  res.once('finish', end)
  res.once('close', end)

  context.with(trace.setSpan(parent, span), next)
}

/** Wraps every method of an object (the store) in a client span named `prefix.method`. */
export function traced<T extends object>(target: T, prefix: string, attributes: Attributes = {}): T {
  if (!telemetryEnabled) return target
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) =>
        tracer.startActiveSpan(
          `${prefix}.${String(prop)}`,
          { kind: SpanKind.CLIENT, attributes: { ...attributes, 'db.operation.name': String(prop) } },
          async (span) => {
            try {
              return await value.apply(obj, args)
            } catch (err) {
              recordError(err)
              throw err
            } finally {
              span.end()
            }
          },
        )
    },
  })
}

const SEVERITY = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const

/** Structured log tied to the current request's trace. Attributes are searchable in Loki. */
export function emitLog(level: keyof typeof SEVERITY, body: string, attributes: Attributes = {}, exception?: unknown) {
  if (!telemetryEnabled) return
  logger.emit({ severityNumber: SEVERITY[level], severityText: level.toUpperCase(), body, attributes, exception })
}

/** Marks the current request as failed, with the error attached to its span. */
export function recordError(err: unknown) {
  const span = trace.getActiveSpan()
  if (!span) return
  span.recordException(err instanceof Error ? err : String(err))
  span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) })
}
