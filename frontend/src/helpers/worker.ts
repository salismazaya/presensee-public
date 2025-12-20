let _instance: any;

function getWorker(): typeof import("./_worker") {
  if (!_instance) {
    _instance = new ComlinkWorker<typeof import("./_worker")>(
      new URL("./_worker", import.meta.url)
    );
  }
  return _instance;
}
export async function non_blocking_db_execute(
  query: string,
  params?: any,
  singleton?: boolean
): Promise<any> {
  return await getWorker().db_execute(query, params, singleton);
}

export async function non_blocking_db_prepare(sql: string, params?: any) {
  const stmt = await getWorker().db_prepare(sql, params);
  return stmt;
}

export function remove_statement_ptr(stmt_ptr: number) {
  getWorker().remove_statement_ptr(stmt_ptr);
}

export async function non_blocking_db_step(stmt_ptr: number) {
  return await getWorker().db_step(stmt_ptr);
}

export async function non_blocking_db_get_as_object(stmt_ptr: number) {
  return await getWorker().db_get_as_object(stmt_ptr);
}
