import { bootstrap } from './app/bootstrap.js';
import { GatewayAppModule } from './app/role-modules.js';

await bootstrap('gateway', (config) => GatewayAppModule.forRoot(config));
