import type { createTestDatabase } from '../auth/test-db';
import { SupabaseShopStore, type ShopStore } from './store';

export function createTestShopStore(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
): ShopStore {
  const baseStore = database.shopStore;
  const db = database.db;

  const testFetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const method = init?.method?.toUpperCase() ?? 'GET';

    // Intercept PostgREST table queries for public.purchases
    if (path === '/rest/v1/purchases' || path.endsWith('/rest/v1/purchases')) {
      if (method === 'GET') {
        const search = url.searchParams;
        const invoicePayload = search.get('invoice_payload');
        const userId = search.get('user_id');
        const id = search.get('id');

        if (invoicePayload?.startsWith('eq.')) {
          const payload = invoicePayload.slice(3);
          const res = await db.query(
            'SELECT * FROM public.purchases WHERE invoice_payload = $1',
            [payload],
          );
          return Response.json(res.rows);
        }

        if (userId?.startsWith('eq.')) {
          const uid = userId.slice(3);
          if (id?.startsWith('eq.')) {
            const invoiceId = id.slice(3);
            const res = await db.query(
              'SELECT * FROM public.purchases WHERE user_id = $1 AND id = $2',
              [uid, invoiceId],
            );
            return Response.json(res.rows);
          }
          const payloadParam = search.get('invoice_payload');
          if (payloadParam?.startsWith('eq.')) {
            const payload = payloadParam.slice(3);
            const res = await db.query(
              'SELECT * FROM public.purchases WHERE user_id = $1 AND invoice_payload = $2',
              [uid, payload],
            );
            return Response.json(res.rows);
          }
        }
        return Response.json([]);
      }

      if (method === 'PATCH') {
        const search = url.searchParams;
        const idParam = search.get('id');
        const id = idParam?.startsWith('eq.') ? idParam.slice(3) : null;
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (id && body.metadata) {
          await db.query(
            'UPDATE public.purchases SET metadata = metadata || $1::jsonb WHERE id = $2',
            [JSON.stringify(body.metadata), id],
          );
        }
        return new Response(null, { status: 200 });
      }
    }

    // Intercept PostgREST table insert for public.reward_ledger
    if (
      path === '/rest/v1/reward_ledger' ||
      path.endsWith('/rest/v1/reward_ledger')
    ) {
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        await db.query(
          `INSERT INTO public.reward_ledger (user_id, delta_cash, delta_season_points, reason, idempotency_key, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            body.user_id,
            body.delta_cash ?? 0,
            body.delta_season_points ?? 0,
            body.reason,
            body.idempotency_key,
            JSON.stringify(body.metadata ?? {}),
          ],
        );
        return new Response(null, { status: 201 });
      }
    }

    // Delegate all other calls (RPCs like empire_shop_get_pass, empire_shop_create_invoice, empire_shop_fulfill_payment)
    const baseFetcher = (baseStore as unknown as { fetcher: typeof fetch })
      .fetcher;
    return baseFetcher(input, init);
  };

  return new SupabaseShopStore(
    'https://test.supabase.co',
    'test-service-key',
    testFetcher,
  );
}
