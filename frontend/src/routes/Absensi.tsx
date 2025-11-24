import { useEffect, useRef, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { Link } from "react-router";
import useUser from "../hooks/useUser";
import {
  getAbsensies,
  getIsLocked,
  getKelas,
  getSiswa,
  lockAbsensi,
  unlockAbsensi,
} from "../helpers/database";
import useDatabase from "../hooks/useDatabase";
import useKelas from "../hooks/useKelas";
import useRefreshDatabase from "../hooks/useRefreshDatebase";
import Swal from "sweetalert2";
import { getAbsensiesProgress } from "../helpers/api";
import useToken from "../hooks/useToken";
import { toast } from "react-toastify";

// Helper Display
function formatDisplayDate(dateStr: string) {
  const [dayName, fullDate] = dateStr.split(", ");
  const [d, m, y] = fullDate.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Ags",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return {
    day: dayName,
    date: d,
    month: monthNames[parseInt(m) - 1],
    year: `20${y}`,
  };
}

// Helper Date Logic
function formatDate(date: Date) {
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayName = days[date.getDay()];
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dayName}, ${dd}-${mm}-${yy}`;
}

function getDates() {
  const dates = [];
  const today = new Date();

  // Batasi hanya sampai hari ini (Masa depan tidak muncul)
  const startRange = -365;
  const endRange = 0;

  for (let i = endRange; i >= startRange; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

export default function Absensi() {
  const [user] = useUser();
  const dateNowString = formatDate(new Date());
  const today = new Date();

  const [allDates] = useState(getDates());
  const db = useDatabase();
  const refreshDb = useRefreshDatabase();
  const [kelas] = useKelas();
  const [kelasName, setKelasName] = useState("");
  const [viewDate, setViewDate] = useState(new Date());
  const [filteredDates, setFilteredDates] = useState<string[]>([]);

  const [token] = useToken();

  const [progressAbsensi, setProgressAbsensi] = useState<
    Record<string, { totalTidakMasuk: number; isComplete: boolean }>
  >({});

  const [absensies, setAbsensies] = useState<
    Record<string, { totalTidakMasuk: number; isComplete: boolean }>
  >({});

  const dataServerLoaded = useRef(false);

  const monthNamesFull = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  // Cek apakah sedang melihat bulan & tahun saat ini
  const isCurrentMonth =
    viewDate.getMonth() === today.getMonth() &&
    viewDate.getFullYear() === today.getFullYear();

  const changeMonth = (offset: number) => {
    // Cegah user pindah ke bulan depan (masa depan)
    if (offset > 0 && isCurrentMonth) return;

    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  useEffect(() => {
    const targetMonth = viewDate.getMonth() + 1;
    const targetYear = viewDate.getFullYear() % 100;

    const currentMonthDates = allDates.filter((dateStr) => {
      const [, fullDate] = dateStr.split(", ");
      const [, m, y] = fullDate.split("-");
      return parseInt(m) === targetMonth && parseInt(y) === targetYear;
    });

    setFilteredDates(currentMonthDates);
  }, [viewDate, allDates]);

  useEffect(() => {
    if (!db) return;

    const newAbsensiesProgress: any = {};

    filteredDates.forEach((dateString) => {
      const siswas = getSiswa({
        db,
        whereQuery: `kelas_id=${kelas}`,
      });
      const [dd, mm, yy] = dateString.split(", ")[1].split("-", 3);
      const formattedDateForQuery = `20${yy}-${mm}-${dd}`;

      const absensies = getAbsensies({
        db,
        sql: `SELECT absensi.status FROM absensi JOIN siswa ON absensi.siswa_id = siswa.id WHERE siswa.kelas_id = ${kelas} AND absensi.date = "${formattedDateForQuery}";`,
      });

      const totalTidakMasuk = absensies.filter(
        (a) => a.status !== "hadir"
      ).length;
      const isComplete = absensies.length >= siswas.length && siswas.length > 0;

      newAbsensiesProgress[dateString] = {
        totalTidakMasuk,
        isComplete,
      };
    });

    setAbsensies(newAbsensiesProgress);
    setProgressAbsensi(newAbsensiesProgress);
  }, [filteredDates, db]);

  useEffect(() => {
    if (dataServerLoaded.current) return;
    // load hanya sekali. biar user tidak bingung di-spam notif
    
    if (!token || !kelas) return;

    // Format key: Jum, 21-11-25
    const dates = Object.keys(progressAbsensi);

    if (dates.length == 0) return;

    // Formatnya adalah: Jum, 21-11-25 jadi harus di-format dulu
    const formattedDates = dates.map((d) => {
      const ddmmyy = d.split(", ")[1];
      const [dd, mm, yy] = ddmmyy.split("-");

      return `20${yy}-${mm}-${dd}`;
    });

    getAbsensiesProgress(token, formattedDates, kelas).then((ap) => {
      const newAbsensiesProgress: any = {};

      Object.keys(ap).forEach((key) => {
        const datetime = new Date(key);
        // const [dd, mm, yy] = key.split("-");
        const formattedKey = formatDate(datetime);
        
        const oldAbsensiProgress = progressAbsensi[formattedKey];
        // console.log(progressAbsensi)
        const absensiProgress = {
          totalTidakMasuk: ap[key].total_tidak_masuk,
          isComplete: ap[key].is_complete,
        };

        // console.log(formattedKey, oldAbsensiProgress, absensiProgress);

        if (!oldAbsensiProgress.isComplete && absensiProgress.isComplete) {
          newAbsensiesProgress[formattedKey] = absensiProgress;
        } else {
          newAbsensiesProgress[formattedKey] = oldAbsensiProgress;
        }
      });

      toast.success("Menerima data dari server", {
        autoClose: 1000,
        closeOnClick: true,
      });

      setProgressAbsensi(newAbsensiesProgress);
    }).finally(() => {
      dataServerLoaded.current = true;
    });
  }, [absensies, token]);

  useEffect(() => {
    if (!db || !kelas) return;
    const currentKelas = getKelas({ db, whereQuery: `id=${kelas}` });
    if (currentKelas.length >= 1) setKelasName(currentKelas[0].name);
  }, [db, kelas]);

  const handleToggleLock = (
    date: string,
    kelasId: number,
    isLocked: boolean
  ) => {
    const action = isLocked ? "Buka Kunci" : "Kunci Absensi";
    const fn = isLocked ? unlockAbsensi : lockAbsensi;

    Swal.fire({
      title: `${action}?`,
      text: isLocked
        ? "Data bisa diedit kembali."
        : "Data tidak akan bisa diedit.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Lakukan",
    }).then((result) => {
      if (result.isConfirmed) {
        fn({ db, date, kelas_id: kelasId });
        refreshDb();
      }
    });
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans h-screen overflow-hidden">
      <Navbar />

      <main className="flex-grow p-4 md:p-6 flex flex-col h-full overflow-hidden">
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-4 h-full">
          {/* HEADER CONTROLS */}
          <div className="flex-none flex flex-row justify-between items-center bg-base-100 p-3 md:p-4 rounded-2xl shadow-sm border border-base-300">
            <div>
              <div className="text-[10px] md:text-xs font-bold text-base-content/50 uppercase tracking-wider">
                Kelas
              </div>
              <div className="text-xl md:text-2xl font-bold text-primary truncate max-w-[150px]">
                {kelasName || "..."}
              </div>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center bg-base-200 rounded-xl p-1 border border-base-300/50">
              <button
                onClick={() => changeMonth(-1)}
                className="btn btn-sm btn-ghost btn-square"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <div className="px-3 text-center w-[120px] md:w-[140px]">
                <div className="font-bold text-sm md:text-base">
                  {monthNamesFull[viewDate.getMonth()]}
                </div>
                <div className="text-[10px] text-base-content/60">
                  {viewDate.getFullYear()}
                </div>
              </div>

              <button
                onClick={() => changeMonth(1)}
                disabled={isCurrentMonth} // Tombol Next Mati jika bulan ini
                className="btn btn-sm btn-ghost btn-square disabled:bg-transparent disabled:opacity-20"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* TABLE AREA */}
          <div className="card bg-base-100 shadow-xl rounded-2xl border border-base-300 flex-grow flex flex-col overflow-hidden">
            <div className="flex-none grid grid-cols-12 gap-2 px-4 py-3 bg-base-100 border-b border-base-200 z-20 font-bold text-sm text-base-content/70 sticky top-0 shadow-sm">
              <div className="col-span-4 md:col-span-3 pl-2">Tanggal</div>
              <div className="col-span-3 md:col-span-3 text-center">Status</div>
              <div className="col-span-2 md:col-span-2 text-center">TM</div>
              <div className="col-span-3 md:col-span-4 text-right pr-2">
                Aksi
              </div>
            </div>

            <div className="flex-grow overflow-y-auto scrollbar-thin pb-20">
              {filteredDates.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-base-content/40">
                  <p>Tidak ada data tanggal.</p>
                </div>
              )}

              {Object.keys(progressAbsensi).map((dateString) => {
                const isToday = dateString === dateNowString;
                const isSunday = dateString.startsWith("Min");
                const { day, date, month } = formatDisplayDate(dateString);
                const [dd, mm, yy] = dateString.split(", ")[1].split("-");
                const dateForLink = `20${yy}-${mm}-${dd}`;
                
                
                let locked = false;
                if (kelas)
                  locked = getIsLocked({
                    db,
                    date: dateString.split(", ")[1],
                    kelas_id: kelas,
                  });
                locked = locked || user?.type === "kesiswaan";

                const isComplete = progressAbsensi[dateString].isComplete;
                const totalTidakMasuk = progressAbsensi[dateString].totalTidakMasuk;
                // console.log(dateString, isComplete);

                return (
                  // Row Container
                  <div
                    key={dateString}
                    className={`
                            grid grid-cols-12 gap-2 px-4 py-3 border-b border-base-200 items-center transition-colors
                            ${
                              isToday
                                ? "bg-primary/10 border-l-4 border-l-primary" // Style Khusus HARI INI (Cap Samping + Background)
                                : "hover:bg-base-200/30 border-l-4 border-l-transparent"
                            }
                        `}
                  >
                    {/* Kolom Tanggal & CAP */}
                    <div className="col-span-4 md:col-span-3 pl-2">
                      <div className="flex flex-row items-center gap-3">
                        {/* Tanggal Angka */}
                        <div
                          className={`text-xl font-bold w-8 text-center ${
                            isSunday ? "text-error" : "text-base-content"
                          }`}
                        >
                          {date}
                        </div>

                        {/* Hari & Bulan */}
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold uppercase ${
                                isToday ? "text-primary" : "opacity-70"
                              }`}
                            >
                              {day}
                            </span>

                            {/* === CAP HARI INI === */}
                            {isToday && (
                              <span className="badge badge-xs md:badge-sm badge-primary font-bold shadow-sm animate-pulse text-[7px] lg:text-[9px] p-0.5">
                                HARI INI
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider opacity-50">
                            {month}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-3 md:col-span-3 flex justify-center">
                      {isComplete ? (
                        <span className="badge badge-success font-bold badge-md text-base-100 border-none shadow-sm">
                          Selesai
                        </span>
                      ) : (
                        <span className="badge badge-ghost badge-md opacity-50 bg-base-200">
                          Belum
                        </span>
                      )}
                    </div>

                    {/* TM */}
                    <div className="col-span-2 md:col-span-2 text-center font-semibold text-sm">
                      {totalTidakMasuk > 0 ? (
                        <span
                          className={
                            totalTidakMasuk >= 5 ? "text-error" : "text-warning"
                          }
                        >
                          {totalTidakMasuk}
                        </span>
                      ) : (
                        <span className="opacity-80">0</span>
                      )}
                    </div>

                    {/* Aksi */}
                    <div className="col-span-3 md:col-span-4 flex justify-end items-center gap-2 pr-2">
                      {!isSunday && (
                        <>
                          <Link
                            to={"/absensi/" + dateForLink}
                            className={`
                                btn btn-sm font-semibold shadow-sm border-none
                                ${
                                  locked
                                    ? "bg-base-200 text-base-content/60 hover:bg-base-300"
                                    : "btn-primary text-white hover:brightness-110"
                                }
                              `}
                          >
                            {locked ? "Lihat" : "Edit"}
                          </Link>

                          {user?.type === "wali_kelas" && (
                            <button
                              onClick={() =>
                                kelas &&
                                handleToggleLock(
                                  dateString.split(", ")[1],
                                  kelas,
                                  locked
                                )
                              }
                              className="btn btn-sm btn-square btn-ghost text-base-content/40 hover:text-base-content"
                            >
                              {locked ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-4 h-4 text-warning"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer active="users" />
    </div>
  );
}
