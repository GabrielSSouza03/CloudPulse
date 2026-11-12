import { bootstrap } from './app/bootstrap.js';
import { ApiAppModule } from './app/role-modules.js';

await bootstrap('api', (config) => ApiAppModule.forRoot(config));
