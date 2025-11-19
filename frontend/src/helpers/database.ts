import Swal from "sweetalert2";
import { refreshDatabase } from "./api";
import { insert, insertStagingAbsens } from "./stagingDatabase";
// LZString mungkin tidak diperlukan lagi karena IndexedDB kapasitasnya besar,
// tapi jika ingin tetap dikompresi, Anda bisa menggunakannya.
// import LZString from "lz-string"; 
import { openDB } from 'idb';

// --- SETUP INDEXED DB ---
const DB_NAME = 'SchoolDatabase';
const STORE_NAME = 'sql_logs';

// Inisialisasi Database
const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    // Membuat object store untuk menyimpan log SQL
    // autoIncrement: true agar urutannya terjaga saat di-load nanti
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { autoIncrement: true });
    }
  },
});

// --- INTERFACES ---
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

interface GetIsLockedProps {
  db: any;
  kelas_id: number;
  date: string;
}

interface RefreshRemoteDatabaseProps {
  db: any;
  token: string;
}

interface LockAbsensiProps {
  db: any;
  date: string;
  kelas_id: number;
}

export interface InsertAbsensProps {
  siswaId: number;
  kelasId: number;
  date: string;
  status: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
}

export interface KelasProps {
  id: number;
  name: string;
}

// --- READ FUNCTIONS (Synchronous - Memory DB) ---
// Fungsi-fungsi ini tetap sama karena membaca dari db sql.js (memory)

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

export function getIsLocked(data: GetIsLockedProps) {
  const [dd, mm, yy] = data.date.split("-", 3);
  let sql = `SELECT * FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id}`;
  const stmt = data.db.prepare(sql);
  return stmt.step();
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

// --- WRITE FUNCTIONS (Updated for IndexedDB) ---

// Menjadi Async karena refreshRemoteDatabase sekarang async
export async function refreshRemoteDatabase(
  data: RefreshRemoteDatabaseProps
): Promise<void> {
  try {
    const sql = await refreshDatabase(data.token);
    
    // Hapus data lama di IndexedDB dan masukkan yang baru
    const db = await dbPromise;
    await db.clear(STORE_NAME); // Kosongkan store
    await insertToLocalDatabase(sql); // Masukkan SQL awal
    
  } catch (e: any) {
    Swal.fire({
      icon: "error",
      text: e.toString(),
    });
    throw e; // Rethrow agar caller tau error
  }
}

// Menjadi Async
export async function lockAbsensi(data: LockAbsensiProps) {
  const [dd, mm, yy] = data.date.split("-", 3);
  const sql = `INSERT INTO kunci_absensi (date, kelas_id) VALUES ("20${yy}-${mm}-${dd}", ${data.kelas_id})`;

  data.db.run(sql); // Run di memory DB (sync)

  insert({
    action: "lock",
    data: {
      date: data.date,
      kelas: data.kelas_id,
    },
  });
  
  // Simpan ke IndexedDB (Async)
  await insertToLocalDatabase(sql);
}

// Menjadi Async
export async function insertAbsens(db: any, datas: InsertAbsensProps[]) {
  let insertSql = `INSERT INTO absensi (date, siswa_id, status) VALUES `;
  let deleteSql = `DELETE FROM absensi WHERE `;

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

  // Jalankan di SQL Memory (Sync)
  db.run(deleteSql);
  db.run(insertSql);

  insertStagingAbsens(datas);

  // Simpan ke IndexedDB (Async)
  await insertToLocalDatabase(deleteSql);
  await insertToLocalDatabase(insertSql);
}

// Menjadi Async
export async function unlockAbsensi(data: LockAbsensiProps) {
  const [dd, mm, yy] = data.date.split("-", 3);
  const sql = `DELETE FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id};`;

  data.db.run(sql);

  insert({
    action: "unlock",
    data: {
      date: data.date,
      kelas: data.kelas_id,
    },
  });
  
  await insertToLocalDatabase(sql);
}

// --- CORE STORAGE FUNCTION ---

/**
 * Menyimpan perintah SQL ke IndexedDB.
 * Kita tidak lagi menumpuk string raksasa dan mengompresnya,
 * melainkan menyimpan setiap perintah sebagai baris baru (log).
 * Ini jauh lebih cepat dan efisien memori.
 */
export async function insertToLocalDatabase(sql: string) {
  if (!sql) return;
  
  const db = await dbPromise;
  // Add ke store. Karena autoIncrement, dia akan tersimpan urut.
  await db.add(STORE_NAME, sql);
}

/**
 * FUNGSI TAMBAHAN:
 * Anda perlu memanggil fungsi ini saat aplikasi pertama kali loading (init)
 * untuk mengambil semua SQL yang tersimpan di IndexedDB dan menjalankannya
 * ke sql.js (memory db).
 */
export async function loadLocalDatabase(sqlDbInstance: any) {
  const db = await dbPromise;
  // Ambil semua transaksi dari cursor untuk hemat memori jika datanya sangat besar,
  // atau getAll() jika datanya masih wajar. getAll() lebih cepat.
  const allSqlCommands = await db.getAll(STORE_NAME);
  
  if (allSqlCommands && allSqlCommands.length > 0) {
    allSqlCommands.forEach((sqlCmd) => {
      try {
        sqlDbInstance.run(sqlCmd);
      } catch (err) {
        console.error("Gagal menjalankan replay SQL:", sqlCmd, err);
      }
    });
  }
}