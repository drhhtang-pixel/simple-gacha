// Optional manual run of the schema (the API also applies it on first use):
// POSTGRES_URL=... node db/migrate.mjs
import postgres from 'postgres';
import { connectionUrl } from '../api/_lib.mjs';
import { SCHEMA } from './schema.mjs';

const sql = postgres(connectionUrl(), { ssl: 'require', prepare: false, max: 1 });
await sql.unsafe(SCHEMA);
console.log('schema applied');
await sql.end();
