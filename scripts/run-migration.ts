import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const client = new Client({
    connectionString: process.env.ERP_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sqlPath = join(process.cwd(), 'scripts', 'inventory-module-enhancements.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
