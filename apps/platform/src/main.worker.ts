import { bootstrap } from './app/bootstrap.js';
import { WorkerAppModule } from './app/role-modules.js';

await bootstrap('worker', (config) => WorkerAppModule.forRoot(config));
