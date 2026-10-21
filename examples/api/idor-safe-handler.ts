/**
 * Защита от IDOR/BOLA (OWASP API1) и mass assignment (API3).
 * Принципы:
 *  - tenant/owner берётся ТОЛЬКО из серверной сессии, не из тела/URL;
 *  - каждый запрос к объекту фильтрует по tenant_id (и RLS как второй рубеж);
 *  - чужой объект → 404 (не подтверждаем существование);
 *  - обновление — по allowlist полей (zod), лишние поля отвергаются.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import type { Pool } from "pg";

interface Session { userId: string; tenantId: string; role: "member" | "admin"; }
declare module "express-serve-static-core" { interface Request { session?: Session } }

const IdParam = z.object({ id: z.string().uuid() });
// allowlist: role, tenant_id, owner_id, balance и т.п. сюда НЕ входят
const UpdateWatchlist = z.object({
  name: z.string().min(1).max(100).optional(),
  symbols: z.array(z.string().regex(/^[A-Z0-9.\-]{1,20}$/)).max(200).optional(),
}).strict(); // .strict() → 400 на любые неизвестные поля

/** Выполнить запрос в транзакции с tenant-контекстом для RLS (см. examples/db/tenant-rls.sql). */
async function withTenant<T>(pool: Pool, s: Session, fn: (q: Pool["query"]) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [s.tenantId]); // true = только на транзакцию
    const out = await fn(client.query.bind(client) as Pool["query"]);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function getWatchlist(pool: Pool) {
  return async (req: Request, res: Response) => {
    const s = req.session;
    if (!s) return res.status(401).end();
    const p = IdParam.safeParse(req.params);
    if (!p.success) return res.status(404).end();

    const row = await withTenant(pool, s, async (q) => {
      // явный фильтр по tenant_id И RLS: если один уровень забыт — второй держит
      const r = await q("SELECT id, name, symbols FROM watchlists WHERE id = $1 AND tenant_id = $2", [p.data.id, s.tenantId]);
      return r.rows[0];
    });
    if (!row) return res.status(404).end(); // и «нет такого», и «чужое» → 404
    return res.json(row);
  };
}

export function updateWatchlist(pool: Pool) {
  return async (req: Request, res: Response) => {
    const s = req.session;
    if (!s) return res.status(401).end();
    const p = IdParam.safeParse(req.params);
    const b = UpdateWatchlist.safeParse(req.body);
    if (!p.success) return res.status(404).end();
    if (!b.success) return res.status(400).json({ error: "invalid_body" });

    const updated = await withTenant(pool, s, async (q) => {
      const r = await q(
        `UPDATE watchlists
            SET name = COALESCE($3, name), symbols = COALESCE($4, symbols), updated_at = now()
          WHERE id = $1 AND tenant_id = $2
        RETURNING id, name, symbols`,
        [p.data.id, s.tenantId, b.data.name ?? null, b.data.symbols ?? null],
      );
      return r.rows[0];
    });
    if (!updated) return res.status(404).end();
    return res.json(updated);
  };
}

/** Function-level authz (API5): админ-эндпоинты проверяют роль на сервере. */
export function requireRole(role: Session["role"]) {
  return (req: Request, res: Response, next: () => void) =>
    req.session?.role === role ? next() : res.status(404).end();
}

/*
 * Тест, который должен быть для КАЖДОГО эндпоинта с :id (псевдокод vitest/supertest):
 *   const a = await createWatchlist(userA);
 *   await request(app).get(`/api/watchlists/${a.id}`).set(auth(userB)).expect(404);
 *   await request(app).patch(`/api/watchlists/${a.id}`).set(auth(userB)).send({ name: "x" }).expect(404);
 *   await request(app).patch(`/api/watchlists/${a.id}`).set(auth(userA)).send({ tenant_id: "other" }).expect(400);
 */
