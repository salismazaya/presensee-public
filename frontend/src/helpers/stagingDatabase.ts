const KEY = "STAGING_DATABASE";

export interface StagingDatabaseProps {
  action: "absen" | "lock" | "unlock";
  data: any;
}

interface StagingDatabaseInsertProps {
  action: "absen" | "lock" | "unlock";
  data: string;
}

export function insert(data: StagingDatabaseProps) {
  const dataJson = JSON.stringify(data.data);

  const mantap: StagingDatabaseInsertProps = {
    action: data.action,
    data: dataJson,
  };

  let listData = localStorage.getItem(KEY) ?? "[]";
  const listDataCleaned: StagingDatabaseInsertProps[] = JSON.parse(listData);

  listDataCleaned.push(mantap);

  const newListData = JSON.stringify(listDataCleaned);

  localStorage.setItem(KEY, newListData);
}

export function getStagingDatabase(): StagingDatabaseInsertProps[] {
  let database = localStorage.getItem(KEY) ?? "[]";
  return JSON.parse(database);
}

export function clearStagingDatabase() {
  localStorage.removeItem(KEY);
}

export interface InsertAbsensProps {
  siswaId: number;
  kelasId: number;
  date: string;
  status: "hadir" | "alfa" | "sakit" | "izin" | "bolos";
}

export function insertStagingAbsens(datas: InsertAbsensProps[]) {
  const listData = localStorage.getItem(KEY) ?? "[]";
  const listDataCleaned: StagingDatabaseInsertProps[] = JSON.parse(listData);

  for (const data of datas) {
    const mantap: StagingDatabaseInsertProps = {
      action: "absen",
      data: JSON.stringify({
        kelas: data.kelasId,
        siswa: data.siswaId,
        status: data.status,
        date: data.date,
      }),
    };

    listDataCleaned.push(mantap);
  }

  const newListData = JSON.stringify(listDataCleaned);
  localStorage.setItem(KEY, newListData);
}
