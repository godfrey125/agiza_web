import 'dotenv/config'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const { Pool, types } = pg

// Postgres returns bigint counts and numerics as strings. The admin API expects
// numbers everywhere, so normalise those types once at the driver level.
types.setTypeParser(20, (value) => Number(value))
types.setTypeParser(1700, (value) => Number(value))
types.setTypeParser(1114, (value) => new Date(`${value}Z`).toISOString())
types.setTypeParser(1184, (value) => new Date(value).toISOString())
types.setTypeParser(1082, (value) => value)

export const DATA_DIR = process.env.AGIZA_DATA_DIR || path.join(os.tmpdir(), 'agiza-admin-data')
export const UPLOAD_DIR = process.env.AGIZA_UPLOAD_DIR || path.join(os.tmpdir(), 'agiza-admin-uploads')

const connectionString =
  process.env.RESTAURANT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error(
    'RESTAURANT_DATABASE_URL or DATABASE_URL is required for the Agiza Admin restaurant API.',
  )
}

// The restaurant schema relies on search_path, which is session state and is
// not guaranteed to survive PgBouncer transaction pooling. Point this service
// at Supabase's session pooler (port 5432) and keep the pool small so it does
// not consume the project-wide session client limit.
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: 'agiza-restaurant',
  // Set this at connection startup, not from the async `connect` event, so a
  // query can never run before the schema search path is active.
  options: '-c search_path=restaurant,public',
  max: Number(process.env.PG_POOL_MAX || 2),
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (error) => {
  console.error('Postgres pool error:', error)
})

function toPgPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

const NO_RETURNING_TABLES = new Set(['settings', 'sessions'])

function insertTable(sql) {
  const match = /^\s*insert\s+into\s+([a-z_][a-z0-9_]*)/i.exec(sql)
  return match ? match[1].toLowerCase() : null
}

function prepareRun(sql) {
  let text = sql.trim()
  const table = insertTable(text)
  if (table && !NO_RETURNING_TABLES.has(table) && !/\breturning\b/i.test(text)) {
    text = `${text} returning id`
  }
  return toPgPlaceholders(text)
}

export function nowIso() {
  return new Date().toISOString()
}

export async function dbAll(sql, params = []) {
  const result = await pool.query(toPgPlaceholders(sql), params)
  return result.rows
}

export async function dbGet(sql, params = []) {
  const result = await pool.query(toPgPlaceholders(sql), params)
  return result.rows[0]
}

export async function dbRun(sql, params = []) {
  const result = await pool.query(prepareRun(sql), params)
  return {
    changes: result.rowCount,
    lastInsertRowid: result.rows?.[0]?.id,
    rows: result.rows,
  }
}

function transactionClient(client) {
  return {
    async query(sql, params = []) {
      return client.query(toPgPlaceholders(sql), params)
    },
    prepare(sql) {
      const text = toPgPlaceholders(sql)
      return {
        async run(...params) {
          const result = await client.query(text, params)
          return {
            changes: result.rowCount,
            lastInsertRowid: result.rows?.[0]?.id,
            rows: result.rows,
          }
        },
        async get(...params) {
          const result = await client.query(text, params)
          return result.rows[0]
        },
        async all(...params) {
          const result = await client.query(text, params)
          return result.rows
        },
      }
    },
  }
}

export async function transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(transactionClient(client))
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

// Kept for scripts that used to create the SQLite schema. Supabase tables are
// created by supabase/migrations/20261111000000_restaurant_schema.sql instead.
export async function initSchema() {
  return pool.query('select 1')
}

export async function closePool() {
  await pool.end()
}
