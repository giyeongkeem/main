/**
 * PostgreSQL 저장 백엔드 — DATABASE_URL 이 설정되면 사용됩니다.
 * (Supabase, Neon 등 표준 Postgres 연결 문자열과 호환)
 *
 * 리스팅 전체를 jsonb 문서로 보관하므로, 로컬 JSON 백엔드와 데이터 형태가 동일합니다.
 * 테이블/시드는 첫 접근 시 자동 생성됩니다.
 */
import { Pool } from "pg";
import type { Listing } from "./types";

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const local = !!connectionString && /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

let ready: Promise<void> | null = null;
function ensure(seed: Listing[]): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const db = getPool();
      await db.query(
        `create table if not exists listings (
           id text primary key,
           data jsonb not null,
           updated_at timestamptz not null default now()
         );`
      );
      await db.query(
        `create table if not exists app_meta (key text primary key, value text);`
      );
      const seeded = await db.query(`select 1 from app_meta where key = 'seeded'`);
      if (seeded.rowCount === 0) {
        const client = await db.connect();
        try {
          await client.query("begin");
          for (const item of seed) {
            await client.query(
              `insert into listings (id, data) values ($1, $2)
               on conflict (id) do nothing`,
              [item.id, JSON.stringify(item)]
            );
          }
          await client.query(
            `insert into app_meta (key, value) values ('seeded', '1')
             on conflict (key) do nothing`
          );
          await client.query("commit");
        } catch (e) {
          await client.query("rollback");
          throw e;
        } finally {
          client.release();
        }
      }
    })().catch((e) => {
      ready = null; // 실패 시 다음 호출에서 재시도
      throw e;
    });
  }
  return ready;
}

export async function getAll(seed: Listing[]): Promise<Listing[]> {
  await ensure(seed);
  const { rows } = await getPool().query<{ data: Listing }>(
    `select data from listings`
  );
  return rows.map((r) => r.data);
}

export async function saveAll(items: Listing[]): Promise<void> {
  await ensure(items);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("delete from listings");
    for (const item of items) {
      await client.query(
        `insert into listings (id, data) values ($1, $2)`,
        [item.id, JSON.stringify(item)]
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
