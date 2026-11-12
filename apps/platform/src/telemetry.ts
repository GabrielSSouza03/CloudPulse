/**
 * OpenTelemetry bootstrap, loaded with `node --import ./dist/telemetry.js` before the app so
 * instrumentations can patch modules (ESM hook) before they are imported.
 *
 * Export is opt-in: without OTEL_EXPORTER_OTLP_ENDPOINT nothing is started and the API's no-op
 * tracer is used, so local runs without the `obs` profile pay no cost.
 */
import { register } from 'node:module';
import { basename } from 'node:path';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const disabled = process.env.OTEL_SDK_DISABLED === 'true';

function serviceName(): string {
  const entry = basename(process.argv[1] ?? 'platform')
    .replace(/^main\./, '')
    .replace(/\.js$/, '');
  const roleArg = process.argv.find((a) => a.startsWith('--role='));
  return `cloudpulse-${entry}${roleArg ? `-${roleArg.slice('--role='.length)}` : ''}`;
}

if (endpoint && !disabled) {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  process.env.OTEL_SERVICE_NAME ??= serviceName();
  // Stable HTTP semantic conventions (http.server.request.duration in seconds).
  process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http';

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
  const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 15_000,
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });
  sdk.start();

  const shutdown = () => {
    sdk.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
