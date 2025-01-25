import { DrizzleAppSchema } from '@powersync/drizzle-driver';
import { DrizzleSchema } from './DrizzleSchema';

export const AppSchema = new DrizzleAppSchema(DrizzleSchema);

export type Database = (typeof AppSchema)['types'];
