import type { Database, Statement } from "sql.js";
import { getLocalDatabase } from "./database";

let db: Database | null = null;

export async function db_execute(
  query: string,
  params?: any,
  singleton?: boolean
) {
  let localDb: Database | null = null;
  if (singleton === true || singleton === undefined) {
    if (!db) {
      localDb = (await getLocalDatabase()).db;
      db = localDb;
    } else {
      localDb = db;
    }
  } else {
    localDb = (await getLocalDatabase()).db;
  }
  return localDb.exec(query, params);
}

const STATEMENT_POINTERS: Record<number, Statement> = {};
let STATEMENT_COUNTER = 0;

export async function db_prepare(sql: string, params?: any) {
  if (!db) {
    const localDb = await getLocalDatabase();
    db = localDb.db;
  }
  const stmt = db.prepare(sql, params);
  const pointer = ++STATEMENT_COUNTER;
  STATEMENT_POINTERS[pointer] = stmt;
  return pointer;
}

function get_statement(stmt_ptr: number) {
  return STATEMENT_POINTERS[stmt_ptr];
}

export function remove_statement_ptr(stmt_ptr: number) {
  delete STATEMENT_POINTERS[stmt_ptr];
}

export async function db_step(stmt_ptr: number) {
  const stmt = get_statement(stmt_ptr);
  return stmt.step();
}

export async function db_get_as_object(stmt_ptr: number) {
  const stmt = get_statement(stmt_ptr);
  return stmt.getAsObject();
}
