import Swal from "sweetalert2";
import { refreshDatabase } from "./api";
import { insert, insertStagingAbsens } from "./stagingDatabase";
import LZString from "lz-string";

export interface SiswaProps {
  id: number;
  fullname: string;
  kelas_id: number;
}

interface DatabaseProps {
  db: any;
  whereQuery?: string;
  sql?: string;
}

export interface AbsensiProps {
  id?: number;
  date?: string;
  siswa_id: number;
  status?: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
}

export function getSiswa(data: DatabaseProps) {
  let sql = "SELECT * FROM siswa";

  if (data.whereQuery) {
    sql += " WHERE " + data.whereQuery;
  }

  const stmt = data.db.prepare(sql);
  const result: SiswaProps[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push(row);
  }

  return result;
}

interface GetIsLockedProps {
  db: any;
  kelas_id: number;
  date: string;
}

interface RefreshRemoteDatabaseProps {
  db: any;
  token: string;
}

export function refreshRemoteDatabase(
  data: RefreshRemoteDatabaseProps
): Promise<void> {
  return new Promise((resolve, reject) => {
    refreshDatabase(data.token)
      .then((sql) => {
        localStorage.removeItem("DATABASE");
        insertToLocalDatabase(sql);
        resolve();
      })
      .catch((e) => {
        Swal.fire({
          icon: "error",
          text: e.toString(),
        });
        reject();
      });
  });
}

export function getIsLocked(data: GetIsLockedProps) {
  const [dd, mm, yy] = data.date.split("-", 3);

  let sql = `SELECT * FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id}`;

  const stmt = data.db.prepare(sql);
  return stmt.step();
}

interface LockAbsensiProps {
  db: any;
  date: string;
  kelas_id: number;
}

export function lockAbsensi(data: LockAbsensiProps) {
  const [dd, mm, yy] = data.date.split("-", 3);

  // let sql = `SELECT * FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id}`;
  const sql = `INSERT INTO kunci_absensi (date, kelas_id) VALUES ("20${yy}-${mm}-${dd}", ${data.kelas_id})`;

  data.db.run(sql);

  insert({
    action: "lock",
    data: {
      date: data.date,
      kelas: data.kelas_id,
    },
  });
  insertToLocalDatabase(sql);
}

export interface InsertAbsensProps {
  siswaId: number;
  kelasId: number;
  date: string;
  status: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
}

export function insertAbsens(db: any, datas: InsertAbsensProps[]) {
  let insertSql = `
  INSERT INTO absensi (date, siswa_id, status) VALUES 
  `;

  let deleteSql = `
  DELETE FROM absensi WHERE
  `;

  const insertsData: string[] = [];
  const deletesData: string[] = [];

  datas.forEach((data) => {
    const [dd, mm, yy] = data.date.split("-", 3);
    const date = `20${yy}-${mm}-${dd}`;
    insertsData.push(`("${date}",${data.siswaId},"${data.status}")`);
    deletesData.push(`date="${date}" AND siswa_id=${data.siswaId}`);
  });

  insertSql += insertsData.join(",") + ";";
  deleteSql += deletesData.join(" OR ") + ";";

  insertSql = insertSql.trim();
  deleteSql = deleteSql.trim();

  db.run(deleteSql);
  db.run(insertSql);

  insertStagingAbsens(datas);
  insertToLocalDatabase(deleteSql);
  insertToLocalDatabase(insertSql);
}

export function unlockAbsensi(data: LockAbsensiProps) {
  const [dd, mm, yy] = data.date.split("-", 3);

  // let sql = `SELECT * FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id}`;
  const sql = `
  DELETE FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id};
`;

  data.db.run(sql);

  insert({
    action: "unlock",
    data: {
      date: data.date,
      kelas: data.kelas_id,
    },
  });
  insertToLocalDatabase(sql);
}

export function getAbsensies(data: DatabaseProps) {
  let sql = "SELECT * FROM absensi";

  if (data.whereQuery) {
    sql += " WHERE " + data.whereQuery;
  }

  if (data.sql) {
    sql = data.sql;
  }

  const stmt = data.db.prepare(sql);
  const result: AbsensiProps[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push(row);
  }

  return result;
}

export interface KelasProps {
  id: number;
  name: string;
}

export function getKelas(data: DatabaseProps) {
  let sql = "SELECT * FROM kelas";

  if (data.whereQuery) {
    sql += " WHERE " + data.whereQuery;
  }

  const stmt = data.db.prepare(sql);
  const result: KelasProps[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push(row);
  }

  return result;
}

export function insertToLocalDatabase(sql: string) {
  const currentDatabase = localStorage.getItem("DATABASE");
  let database: string = "";

  if (currentDatabase) {
    database = LZString.decompress(currentDatabase);
  }

  database += sql + ";";

  const compressedDatabase = LZString.compress(database);
  localStorage.setItem("DATABASE", compressedDatabase);
}
