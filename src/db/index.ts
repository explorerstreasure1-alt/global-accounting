import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

export const hasDatabase = Boolean(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool: Pool | null = hasDatabase
  ? (globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
      // FIX: zaman aşımı yoktu; DB'ye ulaşılamazsa sorgu SONSUZA KADAR bekliyordu.
      // Giriş (OAuth) akışında bu, sayfanın hiç açılmamasına yol açıyordu.
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 5,
      // Sunucu tarafı: tek bir sorgu 8 sn'den fazla asılı kalmasın.
      statement_timeout: 8000,
      query_timeout: 8000,
    }))
  : null;

if (process.env.NODE_ENV !== "production" && pool) {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = pool ? drizzle(pool) : null;
