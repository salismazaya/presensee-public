import Swal from "sweetalert2";
import { refreshDatabase } from "./api";
import { insert, insertStagingAbsens } from "./stagingDatabase";
import type { ConflictData } from "../components/ConflictsList";
import initSqlJs, { type Database } from "sql.js";

// --- CONFIGURATION ---
const DB_FILENAME = "presensee_db.sqlite";
const SQL_WASM_PATH = "/sql-wasm.wasm";

// --- MUTEX LOCK ---
// Queue untuk mencegah tabrakan saat menulis file (Race Condition)
let saveOperationQueue = Promise.resolve();

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
  siswaId: number;
  status?: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
  updatedAt?: number;
}

export function getSiswa(data: DatabaseProps) {
  let sql = "SELECT * FROM siswa";
  if (data.whereQuery) sql += " WHERE " + data.whereQuery;
  const stmt = data.db.prepare(sql);
  const result: SiswaProps[] = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  return result;
}

interface GetIsLockedProps {
  db: any;
  kelas_id: number;
  date: string;
}

interface RefreshRemoteDatabaseProps {
  db: any; // Ini db lama (bisa null/undefined jika belum init)
  token: string;
}

// ==========================================
// 1. FUNGSI BARU: MENULIS DB KE FILE (OPFS)
// ==========================================
export function saveDatabaseToOPFS(db: any): Promise<void> {
  // Masukkan ke antrian agar tidak bentrok jika dipanggil berturut-turut
  saveOperationQueue = saveOperationQueue.then(async () => {
    try {
      // 1. Ambil root directory
      const root = await navigator.storage.getDirectory();

      // 2. Buat/Ambil file handle
      const fileHandle = await root.getFileHandle(DB_FILENAME, {
        create: true,
      });

      // 3. Export database dari Memory ke Binary Array
      const binaryArray = db.export();

      // 4. Tulis ke disk
      const writable = await fileHandle.createWritable();
      await writable.write(binaryArray);
      await writable.close();

      console.log("Database saved to OPFS successfully.");
    } catch (err) {
      console.error("Failed to save database to OPFS:", err);
    }
  });

  return saveOperationQueue;
}

// ==========================================
// 2. FUNGSI UPDATE: EKSEKUSI & SIMPAN
// ==========================================
export function insertToLocalDatabase(db: any, sql: string) {
  try {
    // 1. Eksekusi di Memory (Cepat, Synchronous)
    // Agar UI langsung terupdate tanpa menunggu disk write
    db.run(sql);

    // 2. Simpan ke File (Background, Asynchronous)
    saveDatabaseToOPFS(db);
  } catch (error) {
    console.error("Error executing SQL:", error);
    throw error;
  }
}

export function refreshRemoteDatabase(
  data: RefreshRemoteDatabaseProps
): Promise<void> {
  return new Promise((resolve, reject) => {
    refreshDatabase(data.token)
      .then(async (sqlDump) => {
        try {
          // Karena ini refresh total, kita buat DB baru
          const SQL = await initSqlJs({ locateFile: () => SQL_WASM_PATH });

          // Buat database kosong baru
          const newDb = new SQL.Database();

          // Jalankan SQL dump (biasanya ribuan line insert)
          newDb.run(sqlDump);

          // Simpan database baru tersebut ke file
          await saveDatabaseToOPFS(newDb);

          resolve();
        } catch (err) {
          reject(err);
        }
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
  const sql = `INSERT INTO kunci_absensi (date, kelas_id) VALUES ("20${yy}-${mm}-${dd}", ${data.kelas_id})`;

  insert({
    action: "lock",
    data: { date: data.date, kelas: data.kelas_id },
  });

  // Panggil fungsi baru: Jalanin SQL di db object, lalu save file
  insertToLocalDatabase(data.db, sql);
}

export interface InsertAbsensProps {
  siswaId: number;
  kelasId: number;
  date: string;
  status: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
  previousStatus?: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
  updatedAt?: number;
}

export function insertAbsens(db: any, datas: InsertAbsensProps[]) {
  let insertSql = `INSERT INTO absensi (date, siswa_id, status, previous_status) VALUES `;
  let deleteSql = `DELETE FROM absensi WHERE `;

  const insertsData: string[] = [];
  const deletesData: string[] = [];
  const datasWithUpdatedAt: InsertAbsensProps[] = [];

  datas.forEach((data) => {
    const datetime = new Date(data.date);
    const yyyy = datetime.getFullYear();
    const mm = datetime.getMonth() + 1;
    const dd = datetime.getDate().toString().padStart(2, "0");
    const date = `${yyyy}-${mm}-${dd}`;

    const sqlPreviousStatus = data.previousStatus
      ? `"${data.previousStatus}"`
      : "null";

    insertsData.push(
      `("${date}",${data.siswaId},"${data.status}",${sqlPreviousStatus})`
    );
    deletesData.push(`date="${date}" AND siswa_id=${data.siswaId}`);

    datasWithUpdatedAt.push({
      ...data,
      date,
      updatedAt: Math.floor(Date.now() / 1000),
    });
  });

  insertSql += insertsData.join(",") + ";";
  deleteSql += deletesData.join(" OR ") + ";";

  insertSql = insertSql.trim();
  deleteSql = deleteSql.trim();

  // Update staging (logika sinkronisasi server)
  insertStagingAbsens(datasWithUpdatedAt);

  // Eksekusi SQL dan Simpan ke File
  // Kita gabung string SQL agar 1 kali save saja (opsional, tapi lebih efisien)
  const combinedSql = `${deleteSql} ${insertSql}`;
  insertToLocalDatabase(db, combinedSql);
}

export function unlockAbsensi(data: LockAbsensiProps) {
  const [dd, mm, yy] = data.date.split("-", 3);
  const sql = `DELETE FROM kunci_absensi WHERE date="20${yy}-${mm}-${dd}" AND kelas_id=${data.kelas_id};`;

  insert({
    action: "unlock",
    data: { date: data.date, kelas: data.kelas_id },
  });

  insertToLocalDatabase(data.db, sql);
}

export async function getLocalDatabase(): Promise<{
  exists: boolean;
  db: Database;
}> {
  const SQL = await initSqlJs({
    locateFile: () => SQL_WASM_PATH,
  });

  try {
    // 2. Akses Root OPFS
    const root = await navigator.storage.getDirectory();

    // 3. Coba ambil file handle
    // Jika file tidak ada, baris ini akan throw error -> masuk ke catch
    const fileHandle = await root.getFileHandle(DB_FILENAME);

    // 4. Baca isi file
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    // 5. Cek apakah file kosong
    if (arrayBuffer.byteLength === 0) {
      console.log("File database kosong, membuat database baru.");
      const db = new SQL.Database();
      return {
        exists: false,
        db,
      };
    }

    // 6. Load binary ke Memory SQL.js
    console.log("Database berhasil dimuat dari OPFS.");
    const db = new SQL.Database(new Uint8Array(arrayBuffer));
    return {
      exists: true,
      db,
    };
  } catch (error) {
    console.log(error)
    // Error biasanya terjadi jika file belum ada (pengguna baru)
    // Maka kita kembalikan database baru yang kosong
    console.log("Database belum ditemukan di OPFS, inisialisasi baru.");
    const db = new SQL.Database();
    return {
      exists: false,
      db,
    };
  }
}

export async function downloadLocalDatabase() {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(DB_FILENAME);
    const file = await fileHandle.getFile();

    // Buat URL object dari file blob
    const url = URL.createObjectURL(file);

    // Buat elemen anchor fake untuk trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_${DB_FILENAME}`; // Nama file saat didownload
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Gagal mendownload database:", error);
    Swal.fire({
      icon: "error",
      title: "Gagal",
      text: "File database belum ada atau terjadi kesalahan.",
    });
  }
}

export function getAbsensies(data: DatabaseProps) {
  let sql = "SELECT * FROM absensi";
  if (data.whereQuery) sql += " WHERE " + data.whereQuery;
  if (data.sql) sql = data.sql;
  const stmt = data.db.prepare(sql);
  const result: AbsensiProps[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push({ kelasId: row.kelas_id, siswaId: row.siswa_id, ...row });
  }
  return result;
}

export interface KelasProps {
  id: number;
  name: string;
}

export function getKelas(data: DatabaseProps) {
  let sql = "SELECT * FROM kelas";
  if (data.whereQuery) sql += " WHERE " + data.whereQuery;
  const stmt = data.db.prepare(sql);
  const result: KelasProps[] = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  return result;
}

export function purgeConflictAbsensi() {
  localStorage.removeItem("CONFLICT_ABSENSI");
}

export function insertConflictAbsensi(absensi: ConflictData) {
  const confclicts = getConflictsAbsensi();
  confclicts.push(absensi);
  localStorage.setItem("CONFLICT_ABSENSI", JSON.stringify(confclicts));
}

export function getConflictsAbsensi(): ConflictData[] {
  const rawConflicts = localStorage.getItem("CONFLICT_ABSENSI") || "[]";
  return JSON.parse(rawConflicts);
}
