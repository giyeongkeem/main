/**
 * PostgreSQL 저장 백엔드 — DATABASE_URL 이 설정되면 사용됩니다.
 * (Supabase, Neon 등 표준 Postgres 연결 문자열과 호환. 서버리스에서는 풀러(pooler) URI 권장)
 *
 * - listings: 리스팅 전체를 jsonb 문서로 보관 (로컬 JSON 백엔드와 데이터 형태 동일)
 * - images:   관리자 업로드 이미지(bytea) — 서버리스(파일쓰기 불가) 환경에서도 업로드 동작
 * 테이블·시드는 첫 접근 시 자동 생성됩니다. (SEED_SAMPLE_DATA=false 로 샘플 시드 생략 가능)
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

/* ---------- 스키마 ---------- */

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
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
      await db.query(
        `create table if not exists images (
           id text primary key,
           mime text not null,
           data bytea not null,
           created_at timestamptz not null default now()
         );`
      );
    })().catch((e) => {
      schemaReady = null; // 실패 시 다음 호출에서 재시도
      throw e;
    });
  }
  return schemaReady;
}

let seedReady: Promise<void> | null = null;
function ensureSeed(seed: Listing[]): Promise<void> {
  if (!seedReady) {
    seedReady = (async () => {
      await ensureSchema();
      const db = getPool();
      const seeded = await db.query(`select 1 from app_meta where key = 'seeded'`);
      if (seeded.rowCount === 0) {
        const skipSeed = process.env.SEED_SAMPLE_DATA === "false";
        const client = await db.connect();
        try {
          await client.query("begin");
          if (!skipSeed) {
            for (const item of seed) {
              await client.query(
                `insert into listings (id, data) values ($1, $2)
                 on conflict (id) do nothing`,
                [item.id, JSON.stringify(item)]
              );
            }
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
      seedReady = null;
      throw e;
    });
  }
  return seedReady;
}

/* ---------- 리스팅 ---------- */

export async function getAll(seed: Listing[]): Promise<Listing[]> {
  await ensureSeed(seed);
  const { rows } = await getPool().query<{ data: Listing }>(`select data from listings`);
  return rows.map((r) => r.data);
}

export async function saveAll(items: Listing[]): Promise<void> {
  await ensureSeed(items);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("delete from listings");
    for (const item of items) {
      await client.query(`insert into listings (id, data) values ($1, $2)`, [
        item.id,
        JSON.stringify(item),
      ]);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/* ---------- 이미지 ---------- */

export async function saveImage(id: string, mime: string, data: Buffer): Promise<void> {
  await ensureSchema();
  await getPool().query(`insert into images (id, mime, data) values ($1, $2, $3)`, [
    id,
    mime,
    data,
  ]);
}

export async function getImage(
  id: string
): Promise<{ mime: string; data: Buffer } | null> {
  await ensureSchema();
  const { rows } = await getPool().query<{ mime: string; data: Buffer }>(
    `select mime, data from images where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
