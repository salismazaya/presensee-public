import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import Navbar from "../../components/Navbar";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import PiketFooter from "../../components/PiketFooter";
import LZString from "lz-string";
import { getJadwal, getSiswas, uploadPiketDatabase } from "../../helpers/api";
import useToken from "../../hooks/useToken";

// --- TIPE DATA ---

// 1. Tipe untuk Tampilan (Logs di kanan)
interface ScanLog {
  name: string;
  kelas: string;
  date: string;
  time: string;
  siswaId: number;
  status: "success" | "failed" | "late"; // Tambah status late
  message?: string; // Pesan tambahan misal "Terlambat"
  timestamp: number;
}

// 2. Tipe untuk Data Upload (Yang akan dikirim ke server)
interface UploadData {
  siswaId: number;
  timestamp: number;
  type: "absen_pulang" | "absen_masuk";
  // date: string;
}

interface Siswa {
  name: string;
  kelas: string;
  kelas_id: number;
}

type JadwalProps = Record<
  string,
  Record<
    string,
    { jam_masuk: string; jam_masuk_sampai: string; jam_keluar: string }
  >
>;

// --- HELPER STORAGE ---

// Helper: Visual Logs (Hanya untuk history di layar)
function getVisualLogs(): ScanLog[] {
  let compressed = localStorage.getItem("PIKET_LOGS_VIEW");
  if (!compressed) return [];
  return JSON.parse(LZString.decompress(compressed));
}

function setVisualLogs(datas: ScanLog[]) {
  const compressed = LZString.compress(JSON.stringify(datas));
  localStorage.setItem("PIKET_LOGS_VIEW", compressed);
}

// Helper: Upload Queue (Data bersih untuk diupload)
function getUploadQueue(): UploadData[] {
  let compressed = localStorage.getItem("PIKET_UPLOAD_QUEUE");
  if (!compressed) return [];
  return JSON.parse(LZString.decompress(compressed));
}

function setUploadQueue(datas: UploadData[]) {
  const compressed = LZString.compress(JSON.stringify(datas));
  localStorage.setItem("PIKET_UPLOAD_QUEUE", compressed);
}

// Helper: Siswa & Jadwal (Sama seperti sebelumnya)
function getLocalSiswas(): Record<string, Siswa> {
  let compressed = localStorage.getItem("PIKET_SISWA_DATA");
  if (!compressed) return {};
  return JSON.parse(LZString.decompress(compressed));
}
function setLocalSiswas(siswas: Siswa[]) {
  const compressed = LZString.compress(JSON.stringify(siswas));
  localStorage.setItem("PIKET_SISWA_DATA", compressed);
}
function getLocalJadwal(): JadwalProps {
  return JSON.parse(localStorage.getItem("PIKET_JADWAL") || "{}");
}
function setLocalJadwal(jadwal: JadwalProps) {
  localStorage.setItem("PIKET_JADWAL", JSON.stringify(jadwal));
}

const getTodayDateString = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  // Mengikuti logika kode asli Anda (tanpa +1 jika memang kode aslinya begitu)
  // Note: getMonth() itu 0-11. Jika di database Anda bulan 1 = "01", maka harusnya +1.
  // Tapi di sini saya ikuti kode yang Anda berikan sebelumnya:

  const mm = date.getMonth().toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function Scan() {
  // State
  const [activeSiswaId, setActiveSiswaId] = useState<number | null>(null);
  const [latestSiswaId, setLatestSiswaId] = useState<number | null>(null);
  const [flash, _setFlash] = useState<"ok" | "error" | null>(null);
  const [overlayData, _setOverlayData] = useState<[string, string] | null>();
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [logs, _setLogs] = useState<ScanLog[]>(() => {
    const savedLogs = getVisualLogs();
    const todayStr = getTodayDateString();

    // Filter: Hanya ambil log yang tanggalnya SAMA dengan hari ini
    const todayLogs = savedLogs.filter((log) => log.date === todayStr);

    // Jika ada data lama yang terbuang, update localStorage agar bersih
    if (todayLogs.length !== savedLogs.length) {
      console.log("Membersihkan log lama...");
      setVisualLogs(todayLogs);
    }

    return todayLogs;
  });
  const [queue, _setQueue] = useState<UploadData[]>(getUploadQueue()); // State antrian upload

  // Hooks
  const [token] = useToken();

  // Refs
  const localSiswas = useRef(getLocalSiswas());
  const localJadwal = useRef(getLocalJadwal());
  const cancelSelectTimeout = useRef<NodeJS.Timeout>(null);
  const overlayTimeout = useRef<NodeJS.Timeout>(null);
  const latestTimeScan = useRef<number>(Date.now());
  const queueRef = useRef(queue);

  // Wrapper untuk update Logs & Queue
  const setLogs = (datas: ScanLog[]) => {
    setVisualLogs(datas);
    _setLogs(datas);
  };

  const setQueue = (datas: UploadData[]) => {
    setUploadQueue(datas);
    _setQueue(datas);
  };

  // Efek Flash Layar
  const setFlash = (data: "ok" | "error") => {
    _setFlash(data);
    setTimeout(() => _setFlash(null), 300);
  };

  // Efek Overlay Nama
  const setOverlayData = (overlay: [string, string] | null) => {
    if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    _setOverlayData(overlay);
    overlayTimeout.current = setTimeout(() => {
      _setOverlayData(null);
    }, 5000);
  };

  // Load Data Awal
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    if (!token) return;
    getSiswas(token).then((siswas) => {
      localSiswas.current = siswas;
      setLocalSiswas(siswas);
    });
    getJadwal(token).then((jadwal) => {
      localJadwal.current = jadwal;
      setLocalJadwal(jadwal);
    });
  }, [token]);

  useEffect(() => {
    // Pastikan token ada sebelum menjalankan timer
    if (!token) return;

    const intervalId = setInterval(() => {
      // BACA DARI REF (Data selalu terbaru, tapi tidak mereset timer)
      const currentQueue = queueRef.current;

      if (currentQueue.length > 0) {
        console.log("Auto upload triggered...");
        processUpload(currentQueue);
      }
    }, 15000); // Murni 15 detik

    // Interval hanya di-reset jika TOKEN berubah (jarang terjadi),
    // TIDAK di-reset jika queue berubah.
    return () => clearInterval(intervalId);
  }, [token]);

  // Hapus Log Visual (Tidak menghapus data antrian upload, hanya visual)
  const handleCancel = (siswaId: number) => {
    const newLogs = logs.filter((log) => log.siswaId !== siswaId);
    setLogs(newLogs);
    setActiveSiswaId(null);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "Log dihapus dari tampilan",
      showConfirmButton: false,
      timer: 1500,
    });
  };

  const handleRowClick = (siswaId: number) => {
    setActiveSiswaId(activeSiswaId === siswaId ? null : siswaId);
    if (cancelSelectTimeout.current) clearTimeout(cancelSelectTimeout.current);
    cancelSelectTimeout.current = setTimeout(
      () => setActiveSiswaId(null),
      5000
    );
  };

  const handleScan = (results: IDetectedBarcode[]) => {
    const nowTimestamp = Date.now();
    // Global Debounce: Mencegah kamera membaca frame ganda dalam 1.5 detik
    if (nowTimestamp - latestTimeScan.current < 1500) return;
    latestTimeScan.current = nowTimestamp;

    // results.forEach((result) => {
    const result = results[0];
    const siswaId = parseInt(result.rawValue);
    const siswa = localSiswas.current[siswaId.toString()];

    // 1. Validasi Siswa
    if (!siswa) {
      setFlash("error");
      new Audio("/error.mp3").play();
      return;
    }

    const existingLog = logs.find((l) => l.siswaId === siswaId);

    if (existingLog) {
      const lastScanTime = existingLog.timestamp * 1000; // Konversi ke ms
      const diffMs = nowTimestamp - lastScanTime;
      const cooldownTime = 180 * 1000;

      if (diffMs < cooldownTime) {
        setFlash("error");
        setOverlayData([siswa.name, "Sudah Absen Barusan"]);
        new Audio("/error.mp3").play();
        return;
      }
    }

    const jadwal = localJadwal.current[siswa.kelas_id.toString()];
    // 2. Validasi Jadwal
    if (!jadwal) {
      setFlash("error");
      setOverlayData([siswa.name, "Jadwal Tidak Ditemukan"]);
      new Audio("/error.mp3").play();
      return;
    }

    setLatestSiswaId(siswaId);

    // Setup Waktu
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = date.getMonth().toString().padStart(2, "0");
    const dd = date.getDate().toString().padStart(2, "0");
    const dateString = `${yyyy}-${mm}-${dd}`;

    const dayIndex = date.getDay();
    const days = [
      "minggu",
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jumat",
      "sabtu",
    ];
    const dayName = days[dayIndex];

    if (!jadwal[dayName]) {
      setFlash("error");
      setOverlayData([siswa.name, "Libur / Tidak Ada Jadwal"]);
      return;
    }

    const jadwalToday = jadwal[dayName];
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const timeString = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const [limitH, limitM] = jadwalToday.jam_masuk_sampai
      .split(":")
      .map(Number);
    const limitMinutes = limitH * 60 + limitM;

    const [outH, outM] = jadwalToday.jam_keluar.split(":").map(Number);
    const outMinutes = outH * 60 + outM;

    // --- LOGIKA JAM ---
    let scanStatus: "success" | "failed" | "late" = "success";
    let scanMessage = siswa.kelas;
    let addToQueue = false;
    let absenType: "absen_pulang" | "absen_masuk" = "absen_masuk";
    const [inH, inM] = jadwalToday.jam_masuk.split(":").map(Number);
    const startMinutes = inH * 60 + inM;
    console.log({currentMinutes, startMinutes})

    if (currentMinutes < outMinutes) {
      // FASE MASUK
      if (currentMinutes < startMinutes) {
        setFlash("error");
        new Audio("/error.mp3").play();
        setOverlayData([
          siswa.name,
          `Absen belum dimulai ${jadwalToday.jam_masuk}`,
        ]);
      } else if (currentMinutes > limitMinutes) {
        scanStatus = "late";
        scanMessage = "Terlambat";
        setFlash("error");
        new Audio("/error.mp3").play();
        setOverlayData([siswa.name, "TERLAMBAT!"]);
      } else {
        scanStatus = "success";
        setFlash("ok");
        new Audio("/ok.mp3").play();
        setOverlayData([siswa.name, siswa.kelas]);

        absenType = "absen_masuk";
        addToQueue = true;
      }
    } else {
      // FASE PULANG
      scanStatus = "success";
      scanMessage = "Pulang";
      addToQueue = true;
      setFlash("ok");
      new Audio("/ok.mp3").play();
      setOverlayData([siswa.name, "Hati-hati di jalan"]);

      absenType = "absen_pulang";
      addToQueue = true;
    }

    const newLog: ScanLog = {
      name: siswa.name,
      kelas: siswa.kelas,
      date: dateString,
      siswaId,
      time: timeString,
      status: scanStatus,
      message: scanMessage,
      timestamp: Math.floor(nowTimestamp / 1000),
    };

    // --- FILTER TAMPILAN (VISUAL) ---
    // Hapus log lama siswa ini dari list (jika ada) supaya tidak numpuk
    const otherLogs = logs.filter((l) => l.siswaId !== siswaId);

    // Masukkan log baru di paling atas
    setLogs([newLog, ...otherLogs]);

    // 4. Update Upload Queue
    if (addToQueue) {
      const newUploadData: UploadData = {
        siswaId,
        timestamp: Math.floor(nowTimestamp / 1000),
        type: absenType,
        // date: dateString,
      };
      const isAlreadyQueued = queue.some((q) => {
        const date = new Date(q.timestamp * 1000);
        const yyyy = date.getFullYear();
        const mm = date.getMonth().toString().padStart(2, "0");
        const dd = date.getDate().toString().padStart(2, "0");
        const qDateString = `${yyyy}-${mm}-${dd}`;

        q.siswaId === siswaId && qDateString === dateString;
      });
      if (!isAlreadyQueued) {
        setQueue([...queue, newUploadData]);
      }
    }

    setTimeout(() => setLatestSiswaId(null), 1000);
    // });
  };

  const filteredLogs = logs.filter((log) =>
    log.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- LOGIKA UPLOAD ---
  const processUpload = async (dataToUpload: UploadData[]) => {
    if (!token || dataToUpload.length === 0) return;

    try {
      console.log("Mengupload data:", dataToUpload);
      const invalids = await uploadPiketDatabase(token, dataToUpload);

      // Update state (ini akan men-trigger useEffect ref sync di atas)
      setQueue(invalids);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen font-sans pb-24 flex flex-col">
      <Navbar />
      <main className="grow p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* --- KOLOM KIRI: SCANNER --- */}
            <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4 md:sticky md:top-24 h-fit z-10">
              {/* Notifikasi Upload mengambil jumlah dari QUEUE, bukan Logs */}
              {queue.length >= 1 && (
                <div
                  role="alert"
                  className="alert bg-blue-50 text-blue-500 shadow-md animate-in slide-in-from-top-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-info h-6 w-6 shrink-0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span className="font-medium text-sm">
                    {queue.length} data siap upload
                  </span>
                </div>
              )}

              <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
                <div className="card-header p-4 border-b border-base-200 bg-base-100">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 text-primary"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"
                      />
                    </svg>
                    Scan QR Code
                  </h2>
                  <p className="text-xs text-base-content/60">
                    Arahkan kamera ke kartu siswa
                  </p>
                </div>

                <div className="relative aspect-square bg-black w-full overflow-hidden group cursor-pointer">
                  <Scanner
                    onScan={handleScan}
                    onError={(error) => console.log(error)}
                    scanDelay={2000}
                    sound={false}
                    formats={["qr_code"]}
                    styles={{
                      container: { width: "100%", height: "100%" },
                      video: {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      },
                    }}
                  />

                  {/* Flash Overlay */}
                  <div
                    className={`absolute inset-0 z-50 ${
                      flash == "ok" ? "bg-green-400/40" : "bg-red-400/40"
                    } pointer-events-none transition-opacity duration-300 ease-out ${
                      flash ? "opacity-100" : "opacity-0"
                    }`}
                  ></div>

                  {/* Info Overlay */}
                  {overlayData && (
                    <div className="absolute bottom-10 left-0 right-0 z-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div
                        className={`inline-block px-6 py-3 rounded-2xl shadow-lg border backdrop-blur-md ${
                          overlayData[1].includes("ERLAMBAT")
                            ? "bg-red-100/90 border-red-200"
                            : "bg-base-100/90 border-base-200"
                        }`}
                      >
                        <p
                          className={`text-lg font-bold ${
                            overlayData[1].includes("ERLAMBAT")
                              ? "text-red-600"
                              : "text-primary"
                          }`}
                        >
                          {overlayData[0]}
                        </p>
                        <p
                          className={`text-sm font-medium ${
                            overlayData[1].includes("ERLAMBAT")
                              ? "text-red-500"
                              : "text-base-content/70"
                          }`}
                        >
                          {overlayData[1]}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary shadow-[0_0_20px_rgba(var(--p),1)] animate-[scan_2s_infinite_linear]"></div>
                </div>
              </div>
            </div>

            {/* --- KOLOM KANAN: RIWAYAT VISUAL (LOGS) --- */}
            <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4">
              {/* Header Riwayat */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-4 rounded-xl shadow-sm border border-base-200 sticky top-17.5 md:static z-20">
                <h3 className="font-bold text-lg text-base-content">
                  Aktivitas Terbaru
                </h3>
                <label className="input input-bordered input-sm flex items-center gap-2 w-full sm:max-w-xs focus-within:input-primary transition-colors">
                  <input
                    type="text"
                    className="grow"
                    placeholder="Cari nama siswa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4 opacity-70"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </label>
              </div>

              {/* List Logs */}
              <div className="space-y-3 min-h-75">
                {filteredLogs.map((log) => {
                  const isActive = activeSiswaId === log.siswaId;
                  const isNew = latestSiswaId === log.siswaId;
                  // Tentukan warna icon berdasarkan status
                  let iconClass = "bg-success/10 text-success";
                  if (log.status === "late")
                    iconClass = "bg-warning/10 text-warning";
                  if (log.status === "failed")
                    iconClass = "bg-error/10 text-error";

                  return (
                    <div
                      key={log.timestamp + log.siswaId}
                      onClick={() => handleRowClick(log.siswaId)}
                      className={`card bg-base-100 shadow-sm border cursor-pointer group transform transition-all duration-300 ease-out 
                      ${
                        isNew
                          ? "animate-pop-in bg-primary/10 border-primary"
                          : "animate-in fade-in slide-in-from-top-4"
                      } 
                      ${
                        isActive
                          ? "border-primary ring-1 ring-primary"
                          : "border-base-200 hover:border-primary/30"
                      }`}
                    >
                      <div className="card-body p-3 md:p-4 flex flex-row items-center gap-3 md:gap-4">
                        <div
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                            isNew ? "scale-110" : ""
                          } ${iconClass}`}
                        >
                          {log.status === "success" ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5 md:w-6 md:h-6"
                            >
                              <path
                                fillRule="evenodd"
                                d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : log.status === "late" ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5 md:w-6 md:h-6"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5 md:w-6 md:h-6"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>

                        <div className="grow min-w-0">
                          <div
                            className={`font-bold text-sm md:text-base truncate transition-colors ${
                              isActive ? "text-primary" : ""
                            }`}
                          >
                            {log.name}
                          </div>
                          <div className="text-xs text-base-content/60 flex items-center gap-2 mt-0.5">
                            <span
                              className={`badge badge-xs font-medium ${
                                log.status === "late"
                                  ? "badge-warning"
                                  : "badge-ghost"
                              }`}
                            >
                              {log.message || log.kelas}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pl-2 border-l border-base-200">
                          <div className="text-right">
                            <div className="font-mono text-sm font-bold text-base-content/80 leading-tight">
                              {log.time}
                            </div>
                            <div className="text-[10px] text-base-content/50 font-medium mt-0.5">
                              {log.date}
                            </div>
                          </div>
                          {isActive && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(log.siswaId);
                              }}
                              className="btn btn-sm btn-square btn-error text-white shadow-md animate-in zoom-in duration-200"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-4 h-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.49 1.478l-.179-.054-2.467 13.024a.75.75 0 0 1-.738.611H7.49a.75.75 0 0 1-.738-.611L4.285 6.641l-.179.054a.75.75 0 1 1-.49-1.478 48.108 48.108 0 0 1 3.878-.512V4.478a2.25 2.25 0 0 1 2.25-2.25h4.5a2.25 2.25 0 0 1 2.25 2.25Zm-6.364 6a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0v-5.25a.75.75 0 0 1 .75-.75Zm4.125 0a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0v-5.25a.75.75 0 0 1 .75-.75Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
      <PiketFooter active="home" />
      <style>{`
        @keyframes scan { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes pop-in { 0% { opacity: 0; transform: scale(0.9) translateY(-20px); } 50% { opacity: 1; transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
        .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
