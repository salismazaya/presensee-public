import type { Database } from "sql.js";
import { getLocalDatabase } from "./database";

let db: Database | null = null;

export async function db_execute(query: string, params: any) {
    if (!db) {
        const localDb = await getLocalDatabase();
        db = localDb.db;
    }
    return db.exec(query, params);
}