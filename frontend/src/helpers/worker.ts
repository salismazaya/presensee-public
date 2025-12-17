// import { getLocalDatabase } from "./database";

const instance = new ComlinkWorker<typeof import("./_worker")>(
    new URL("./_worker", import.meta.url),
);

export async function non_blocking_db_execute(query: string, params: any) : Promise<any> {
    return await instance.db_execute(query, params)
}