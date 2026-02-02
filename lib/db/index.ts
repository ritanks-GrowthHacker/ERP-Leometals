import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as erpSchema from './schema';

// Main Database Connection (for authentication)
const mainConnectionString = process.env.NEXT_PUBLIC_POSTGRESQL_URL_TICKET_SYSTEM!;
const mainClient = postgres(mainConnectionString);
export const mainDb = drizzlePg(mainClient);

// ERP Database Connection
const erpConnectionString = process.env.ERP_DATABASE_URL!;
const erpClient = postgres(erpConnectionString);
export const erpDb = drizzlePg(erpClient, { schema: erpSchema });

export { mainClient, erpClient };
