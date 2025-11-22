import { Link } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import {
  clearStagingDatabase,
  getStagingDatabase,
} from "../helpers/stagingDatabase";
import Swal from "sweetalert2";
import {
  getAbsensies,
  getSiswa,
  insertConflictAbsensi,
  refreshRemoteDatabase,
  type AbsensiProps,
  type SiswaProps,
} from "../helpers/database";
import useDatabase from "../hooks/useDatabase";
import useToken from "../hooks/useToken";
import useRefreshDatabase from "../hooks/useRefreshDatebase";
import useGlobalLoading from "../hooks/useGlobalLoading";
import { ping, uploadDatabase } from "../helpers/api";
import useUser from "../hooks/useUser";
import Rekap from "../components/Rekap";
import useLastRefresh from "../hooks/useLastRefresh";
import { useEffect, useRef, useState } from "react";
import useKelas from "../hooks/useKelas";
import ConflictsList from "../components/ConflictsList";
import { toast } from "react-toastify";

export default function Dashboard() {
  const db = useDatabase();
  const [token] = useToken();
  const refreshLocalDatabase = useRefreshDatabase();
  const [, setIsLoading] = useGlobalLoading();
  const [user] = useUser();
  const [lastRefresh, setLastRefresh] = useLastRefresh();
  const [absensiesHariIni, setAbsensiesHariIni] = useState<AbsensiProps[]>([]);
  const [siswasKelas, setSiswasKelas] = useState<SiswaProps[]>([]);
  const [kelasId] = useKelas();
  const stagingDatabase = getStagingDatabase();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    if (!db || !kelasId || !token) return;

    const dateNow = new Date();
    const date = `${dateNow.getFullYear()}-${(dateNow.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${dateNow.getDate().toString().padStart(2, "0")}`;

    const absensies = getAbsensies({
      db,
      whereQuery: `date="${date}"`,
    });
    const siswasKelas = getSiswa({
      db,
      whereQuery: "kelas_id=" + kelasId,
    });

    setAbsensiesHariIni(absensies);
    setSiswasKelas(siswasKelas);

    ping()
      .then(async () => {
        if (getStagingDatabase().length > 0) {
          const res = await uploadDatabase(token);
          res.conflicts.forEach((conflict) => {
            insertConflictAbsensi(conflict);
          });

          clearStagingDatabase();
          await refreshRemoteDatabase({
            db,
            token,
          });
          refreshLocalDatabase();
          setLastRefresh(new Date().getTime());

          toast.success("Auto upload sukses!", {
            autoClose: 2000,
            closeOnClick: true,
          });
        }
      })
      .finally(() => {
        loaded.current = true;
      });
  }, [db, kelasId, token]);

  const handleRefresh = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      text: "Konfirmasi untuk Refresh data dari server?",
      showCancelButton: true,
      confirmButtonText: "Ya, Refresh",
      cancelButtonText: "Batal",
    });

    const stagingDatabase = getStagingDatabase();
    if (stagingDatabase.length !== 0) {
      Swal.fire({
        icon: "error",
        title: "Gagal Refresh",
        text: "Masih ada data lokal yang belum di-upload. Silakan upload terlebih dahulu.",
      });
      return;
    }

    if (!isConfirmed) return;

    if (token && db) {
      setIsLoading(true);
      try {
        await refreshRemoteDatabase({
          db,
          token,
        });
        refreshLocalDatabase();
        setLastRefresh(new Date().getTime());

        Swal.fire({
          title: "Berhasil",
          text: "Data berhasil diperbaharui",
          icon: "success",
          timer: 1500,
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUpload = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      text: "Konfirmasi untuk Upload data ke server?",
      showCancelButton: true,
      confirmButtonText: "Ya, Upload",
    });

    if (!isConfirmed) return;

    const stagingDatabase = getStagingDatabase();
    if (stagingDatabase.length === 0) {
      Swal.fire({
        icon: "info",
        text: "Tidak ada data baru yang perlu di-upload",
      });
      return;
    }

    if (token && db) {
      setIsLoading(true);
      try {
        const response = await uploadDatabase(token);

        clearStagingDatabase();
        await refreshRemoteDatabase({
          db,
          token,
        });
        refreshLocalDatabase();
        setLastRefresh(new Date().getTime());

        if (response.conflicts.length == 0) {
          Swal.fire({
            title: "Upload Berhasil!",
            text: "Semua data telah disinkronisasi.",
            icon: "success",
          });
        } else {
          response.conflicts.forEach((conflict) => {
            insertConflictAbsensi(conflict);
          });

          Swal.fire({
            title: "Upload Berhasil!",
            text: "Data telah disinkronisasi.",
            icon: "success",
            iconColor: "blue",
          }).finally(() => {
            setTimeout(() => {
              window.location.reload();
            }, 300);
          });
        }
      } catch (e: any) {
        Swal.fire({
          title: "Upload Gagal",
          text: e.toString(),
          icon: "error",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Helper untuk status warna dan teks
  const getStatusAbsensi = () => {
    if (absensiesHariIni.length === 0) {
      return {
        text: "Hari ini belum absen",
        color: "text-warning",
        badge: "badge-warning",
      };
    }
    if (absensiesHariIni.length < siswasKelas.length) {
      return {
        text: "Absensi belum lengkap",
        color: "text-warning",
        badge: "badge-warning",
      };
    }
    return {
      text: "Absensi selesai",
      color: "text-success",
      badge: "badge-success",
    };
  };

  const status = getStatusAbsensi();

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Section: Header & Status Card */}
          {user?.type === "sekretaris" && (
            <div className="card bg-base-100 shadow-xl rounded-2xl border border-base-300">
              <div className="card-body flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="card-title text-2xl font-bold mb-1">
                    Status Absensi
                  </h2>
                  <div
                    className={`text-lg font-medium flex items-center gap-2 ${status.color}`}
                  >
                    <span className={`badge ${status.badge} badge-xs`}></span>
                    {status.text}
                  </div>
                  <p className="text-sm opacity-60 mt-1">
                    {absensiesHariIni.length} dari {siswasKelas.length} siswa
                    sudah diabsen.
                  </p>
                </div>
                <Link
                  to={"/absensi"}
                  className="btn btn-primary btn-wide shadow-lg hover:scale-105 transition-transform"
                >
                  Absen Sekarang
                </Link>
              </div>
            </div>
          )}

          {/* Section: Action Buttons Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tombol Refresh */}
            <button
              className="btn bg-base-100 border-base-300 hover:bg-base-200 hover:border-primary shadow-sm h-auto py-3 flex flex-col gap-1"
              onClick={handleRefresh}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="size-6 text-primary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span className="font-semibold">Sinkronisasi Data</span>
              <span className="text-xs text-base-content/60 font-normal">
                Refresh dari Server
              </span>
            </button>

            {/* Tombol Upload dengan Indikator */}
            {user?.type != "kesiswaan" && (
              <button
                className="btn bg-base-100 border-base-300 hover:bg-base-200 hover:border-primary shadow-sm h-auto py-3 flex flex-col gap-1 relative"
                onClick={handleUpload}
              >
                {stagingDatabase.length >= 1 && (
                  <span className="absolute top-2 right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
                  </span>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="size-6 text-primary"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span className="font-semibold">Upload Data</span>
                <span className="text-xs text-base-content/60 font-normal">
                  {stagingDatabase.length > 0
                    ? `${stagingDatabase.length} data belum diupload`
                    : "Semua data aman"}
                </span>
              </button>
            )}

            <Link
              to={
                user?.type == "kesiswaan"
                  ? "/minta-rekap-kelas"
                  : "/minta-rekap"
              }
              className="btn bg-base-100 border-base-300 hover:bg-base-200 hover:border-primary shadow-sm h-auto py-3 flex flex-col gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6 text-primary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25"
                />
              </svg>
              <span className="font-semibold">Minta Rekap</span>
              <span className="text-xs text-base-content/60 font-normal">
                Download Laporan
              </span>
            </Link>
          </div>

          <ConflictsList />

          {/* Info Terakhir Update */}
          <div className="flex justify-end px-2">
            <p className="text-xs text-base-content/50 italic">
              Terakhir diperbaharui:{" "}
              <span className="font-medium">{lastRefresh}</span>
            </p>
          </div>

          {/* Section: Table / Rekap Data */}
          <div className="card bg-base-100 shadow-xl rounded-2xl border border-base-300 overflow-hidden">
            <div className="card-header p-4 border-b border-base-200 bg-base-100/50 flex justify-between items-center">
              <h3 className="font-bold text-lg">Rekapitulasi Bulan Ini</h3>
              <Link to="/rekap" className="btn btn-ghost btn-sm text-primary">
                Lihat Selengkapnya &rarr;
              </Link>
            </div>
            <div className="p-0">
              {/* Mengatur agar Rekap tidak terlalu mepet pinggir jika ia punya padding internal */}
              <Rekap full={false} type="onemonth" />
            </div>
          </div>
        </div>
      </main>

      <Footer active="home" />
    </div>
  );
}
