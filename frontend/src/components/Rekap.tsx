import { useEffect, useState } from "react";
import useDatabase from "../hooks/useDatabase";
import { getKelas } from "../helpers/database";

interface SiswaRekapProps {
  id: number;
  fullname: string;
  kelas_id: number;
  jumlah_hadir: number;
  jumlah_alfa: number;
  jumlah_izin: number;
  jumlah_sakit: number;
  jumlah_bolos: number;
}

interface RekapRrops {
  full: boolean;
  type: "oneweek" | "fiveteendays" | "onemonth" | "alltimes";
  ordering?: "DESC" | "ASC";
  kelasId?: number;
  startDate?: string;
  endDate?: string
}

function RekapMini({ db, siswas }: { db: any; siswas: SiswaRekapProps[] }) {
  const topSiswas = siswas.slice(0, 5);

  let downSiswas: SiswaRekapProps[] = [];

  if (siswas.length >= 5) {
    downSiswas = siswas.slice(siswas.length - 5, siswas.length);
  }

  return (
    <>
      {topSiswas.map((s, i) => {
        const kelas = getKelas({
          db,
          whereQuery: `id=${s.kelas_id}`,
        })[0];
        if (!kelas) return;

        let hadirRate = Math.floor(
          (s.jumlah_hadir * 100) /
          (s.jumlah_alfa +
            s.jumlah_izin +
            s.jumlah_bolos +
            s.jumlah_sakit +
            s.jumlah_hadir)
        );

        if (isNaN(hadirRate)) {
          hadirRate = 0;
        }

        return (
          <tr key={s.id}>
            <th>{i + 1}</th>
            <td>{s.fullname}</td>
            <td>{kelas.name}</td>
            <td>{hadirRate}%</td>
            <td>{s.jumlah_alfa}</td>
            <td>{s.jumlah_bolos}</td>

            <td>{s.jumlah_izin + s.jumlah_sakit}</td>
          </tr>
        );
      })}

      {downSiswas.length >= 1 && (
        <tr>
          <th>...</th>
          <td>...</td>
          <td>...</td>
          <td>...</td>
          <td>...</td>
          <td>...</td>
          <td>...</td>
        </tr>
      )}

      {downSiswas.map((s, i) => {
        const kelas = getKelas({
          db,
          whereQuery: `id=${s.kelas_id}`,
        })[0];
        if (!kelas) return;

        let hadirRate = Math.floor(
          (s.jumlah_hadir * 100) /
          (s.jumlah_alfa +
            s.jumlah_izin +
            s.jumlah_bolos +
            s.jumlah_sakit +
            s.jumlah_hadir)
        );

        if (isNaN(hadirRate)) {
          hadirRate = 0;
        }

        return (
          <tr key={s.id}>
            <th className="text-error">
              {siswas.length - downSiswas.length + i + 1}
            </th>
            <td>{s.fullname}</td>
            <td>{kelas.name}</td>
            <td>{hadirRate}%</td>

            <td>{s.jumlah_alfa}</td>
            <td>{s.jumlah_bolos}</td>
            <td>{s.jumlah_izin + s.jumlah_sakit}</td>
          </tr>
        );
      })}
    </>
  );
}

export default function Rekap(props: RekapRrops) {
  const db = useDatabase();

  const ordering = props.ordering ?? "DESC";
  const kelasId = props.kelasId;
  const startDate = props.startDate ?? `date("now", "start of month")`;
  const endDate = props.endDate ?? `date("now")`;

  const [allsiswas, setAllSiswas] = useState<SiswaRekapProps[]>([]);
  const [siswas, setSiswas] = useState<typeof allsiswas>([]);

  useEffect(() => {
    if (!db) return;

    let sql = `
SELECT 
    s.id,
    s.fullname,
    s.kelas_id,
    SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS jumlah_hadir,
    SUM(CASE WHEN a.status = 'alfa'  THEN 1 ELSE 0 END) AS jumlah_alfa,
    SUM(CASE WHEN a.status = 'izin'  THEN 1 ELSE 0 END) AS jumlah_izin,
    SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) AS jumlah_sakit,
    SUM(CASE WHEN a.status = 'bolos' THEN 1 ELSE 0 END) AS jumlah_bolos,
    SUM(
        CASE a.status
            WHEN 'hadir' THEN 1
            WHEN 'alfa'  THEN -1
            WHEN 'bolos' THEN -2
            ELSE 0
        END
    ) AS skor
FROM siswa s
LEFT JOIN absensi a 
    ON s.id = a.siswa_id
   AND a.date BETWEEN ${startDate} AND ${endDate}
GROUP BY s.id, s.fullname, s.kelas_id
ORDER BY skor ${ordering};
    `;

    const stmt = db.prepare(sql);
    let result: SiswaRekapProps[] = [];

    while (stmt.step()) {
      const row: SiswaRekapProps = stmt.getAsObject() as any;
      result.push(row);
    }

    if (props.kelasId) {
      result = result.filter((a) => a.kelas_id == props.kelasId);
    }

    setAllSiswas(result);
    setSiswas(result);
  }, [db, ordering, kelasId, startDate, endDate]);

  //   return siswas.map((s) => <p>{s.fullname}</p>);

  return (
    <div className="overflow-x-auto mb-10">
      <table className="table">
        {/* head */}
        <thead>
          <tr>
            <th></th>
            <th>Nama</th>
            <th>Kelas</th>
            <th>%</th>

            <th className="text-red-500">A</th>
            <th className="text-red-600">B</th>
            <th className="text-warning">S&I</th>
          </tr>
        </thead>
        <tbody>
          {!props.full && <RekapMini db={db} siswas={siswas}></RekapMini>}
          {props.full &&
            allsiswas.map((s, i) => {
              const kelas = getKelas({
                db,
                whereQuery: `id=${s.kelas_id}`,
              })[0];
              if (!kelas) return;

              let hadirRate = Math.floor(
                (s.jumlah_hadir * 100) /
                (s.jumlah_alfa +
                  s.jumlah_izin +
                  s.jumlah_bolos +
                  s.jumlah_sakit +
                  s.jumlah_hadir)
              );

              if (isNaN(hadirRate)) {
                hadirRate = 0;
              }

              return (
                <tr key={s.id}>
                  <th>{i + 1}</th>
                  <td>{s.fullname}</td>
                  <td>{kelas.name}</td>
                  <td>{hadirRate}%</td>

                  <td>{s.jumlah_alfa}</td>
                  <td>{s.jumlah_bolos}</td>
                  <td>{s.jumlah_izin + s.jumlah_sakit}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
      {/* <a
            href=""
            className="my-4 font-light text-neutral-300 hover:text-neutral-200 mx-auto block text-center text-lg"
          >
            Lebih lanjut...
          </a> */}
      {/* {!props.full && (
        <button className="block mx-auto my-4 btn btn-primary">
          Lihat semua
        </button>
      )} */}
    </div>
  );
}
