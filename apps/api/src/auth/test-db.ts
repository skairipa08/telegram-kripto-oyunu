import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { SupabaseAuthStore } from './store';

// Test-only PostgreSQL engine; never imported by the Worker entrypoint.
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;',
  );
  await db.exec(
    await readFile(
      new URL(
        '../../../../supabase/migrations/202609140001_auth.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const fetcher: typeof fetch = async (input, init) => {
    const name = new URL(String(input)).pathname.split('/').at(-1);
    const p = JSON.parse(String(init?.body));
    let sql: string;
    let args: unknown[];
    switch (name) {
      case 'empire_auth_login':
        sql = 'select public.empire_auth_login($1,$2,$3,$4,$5,$6,$7) as result';
        args = [
          p.p_telegram_id,
          p.p_first_name,
          p.p_username,
          p.p_language,
          p.p_fingerprint,
          p.p_request_hash,
          p.p_auth_date,
        ];
        break;
      case 'empire_auth_session':
        sql = 'select public.empire_auth_session($1) as result';
        args = [p.p_sid];
        break;
      case 'empire_auth_logout':
        sql = 'select public.empire_auth_logout($1) as result';
        args = [p.p_sid];
        break;
      default:
        throw new Error('Unexpected RPC');
    }
    return db.transaction(async (tx) => {
      await tx.exec('set local role service_role');
      const result = await tx.query<{ result: unknown }>(sql, args);
      return Response.json(result.rows[0]?.result ?? null);
    });
  };
  return {
    db,
    store: new SupabaseAuthStore(
      'https://test.supabase.co',
      'test-service-key',
      fetcher,
    ),
  };
}
