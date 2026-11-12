/**
 * Module boundary rules for the modular monolith (see docs/adr/ADR-001).
 * Patterns are unanchored on `src/` so the same rules run against apps/platform and the
 * violation fixture in apps/platform/test/boundaries/fixture.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internals',
      comment:
        'A module may only import another module through its public API (modules/<name>/index.ts).',
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/' },
      to: {
        path: 'src/modules/[^/]+/',
        pathNot: ['src/modules/$1/', 'src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'domain-is-framework-free',
      comment:
        'Domain code must not depend on NestJS, MikroORM, Fastify or other infrastructure libraries.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(@nestjs|@mikro-orm|fastify|pino|kafkajs|@opentelemetry)/' },
    },
    {
      name: 'domain-does-not-import-outer-layers',
      comment:
        'Domain must not import the application, infrastructure or api layers of its module.',
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/domain/' },
      to: { path: 'src/modules/$1/(application|infrastructure|api)/' },
    },
    {
      name: 'application-does-not-import-api',
      comment:
        'Application services must not depend on HTTP controllers, guards or DTO decorators.',
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/application/' },
      to: { path: 'src/modules/$1/api/' },
    },
    {
      name: 'platform-does-not-import-modules',
      comment:
        'Platform and shared kernel are below the business modules and the composition root.',
      severity: 'error',
      from: { path: 'src/(platform|shared-kernel)/' },
      to: { path: 'src/(modules|app)/' },
    },
    {
      name: 'shared-kernel-is-framework-free',
      severity: 'error',
      from: { path: 'src/shared-kernel/' },
      to: { path: 'node_modules/(@nestjs|@mikro-orm|fastify)/' },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'An unresolved import is invisible to every other rule.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/platform/tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
