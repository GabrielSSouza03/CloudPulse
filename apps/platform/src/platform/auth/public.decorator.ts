import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'cloudpulse:isPublic';

/** Marks a route as reachable without credentials (health probes only). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
