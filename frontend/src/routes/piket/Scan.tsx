import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import Navbar from "../../components/Navbar";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import PiketFooter from "../../components/PiketFooter";
import LZString from "lz-string";
import { getSiswas } from "../../helpers/api";
import useToken from "../../hooks/useToken";
import useGlobalLoading from "../../hooks/useGlobalLoading";

// Tipe data mock diperbarui dengan tanggal
interface ScanLog {
  name: string;
  kelas: string;
  date: string;
  time: string;
  siswaId: number;
  timestamp: number;
  status: "success" | "failed";
}

interface Siswa {
  name: string;
  kelas: string;
}

function getData(): ScanLog[] {
  let compressedDatas = localStorage.getItem("PIKET_ABSENSI_DATA");

  if (!compressedDatas) {
    return [];
  }

  compressedDatas = LZString.decompress(compressedDatas);
  return JSON.parse(compressedDatas);
}

function setData(datas: ScanLog[]) {
  const compressedDatas = LZString.compress(JSON.stringify(datas));
  localStorage.setItem("PIKET_ABSENSI_DATA", compressedDatas);
}

function getLocalSiswas(): Record<string, Siswa> {
  let compressedDatas = localStorage.getItem("PIKET_SISWA_DATA");

  if (!compressedDatas) {
    return {};
  }

  compressedDatas = LZString.decompress(compressedDatas);
  return JSON.parse(compressedDatas);
}

function setLocalSiswas(siswas: Siswa[]) {
  const compressedDatas = LZString.compress(JSON.stringify(siswas));
  localStorage.setItem("PIKET_SISWA_DATA", compressedDatas);
}

export default function Scan() {
  const [activeSiswaId, setActiveSiswaId] = useState<number | null>(null);
  const [latestSiswaId, setLatestSiswaId] = useState<number | null>(null);

  // --- 1. STATE UNTUK FLASH ---
  const [flash, setFlash] = useState<"ok" | "error" | null>(null);

  const [logs, _setLogs] = useState<ScanLog[]>(getData());
  const [logCount, setLogCount] = useState(logs.length);

  const [token] = useToken();
  const alreadyScan = useRef<string[]>([]);
  const localSiswas = useRef(getLocalSiswas());
  const [overlayData, _setOverlayData] = useState<[string, string] | null>();

  const [,setIsLoading] = useGlobalLoading();

  const setOverlayData = (overlay: [string, string] | null) => {
    if (overlayTimeout.current) {
      clearTimeout(overlayTimeout.current);
    }

    _setOverlayData(overlay);

    overlayTimeout.current = setTimeout(() => {
      _setOverlayData(null);
    }, 5000);
  };

  useEffect(() => {
    if (!token) return;
    getSiswas(token).then((siswas) => {
      localSiswas.current = siswas;
      setLocalSiswas(siswas);
    });
  }, [token]);

  const setLogs = (datas: ScanLog[]) => {
    setData(datas);
    _setLogs(datas);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const cancelSelectTimeout = useRef<number>(null);
  const overlayTimeout = useRef<number>(null);
  const latestTimeScan = useRef<number>(Date.now());

  const handleCancel = (siswaId: number) => {
    const newLogs = logs.filter((log) => log.siswaId !== siswaId);
    setLogs(newLogs);
    setActiveSiswaId(null);

    const toast = Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 1500,
    });
    toast.fire({ icon: "info", title: "Data dihapus" });
  };

  const handleRowClick = (siswaId: number) => {
    setActiveSiswaId(activeSiswaId === siswaId ? null : siswaId);
    if (cancelSelectTimeout.current) {
      clearTimeout(cancelSelectTimeout.current);
      cancelSelectTimeout.current = null;
    }
    cancelSelectTimeout.current = setTimeout(() => {
      setActiveSiswaId(null);
    }, 5000);
  };

  const handleScan = (results: IDetectedBarcode[]) => {
    const now = Date.now();
    if (now - latestTimeScan.current < 1500) {
      return;
    }
    
    latestTimeScan.current = now;

    results.forEach((result) => {
      const siswaId = parseInt(result.rawValue);

      const siswa: Siswa | undefined = localSiswas.current[siswaId.toString()];
      if (!siswa) {
        setFlash("error");
        new Audio("/error.mp3").play();

        setTimeout(() => setFlash(null), 300);
        return;
      }

      if (alreadyScan.current.includes(siswaId.toString())) {
        setFlash("error");
        setOverlayData([siswa.name, "Sudah diabsen"]);
        new Audio("/error.mp3").play();
        setTimeout(() => setFlash(null), 300);
        return;
      }

      setLatestSiswaId(siswaId);

      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = date.getMonth().toString().padStart(2, "0");
      const dd = date.getDate().toString().padStart(2, "0");

      const dateString = `${yyyy}-${mm}-${dd}`;
      const timestamp = Math.floor(Date.now() / 1000);

      setOverlayData([siswa.name, siswa.kelas]);

      new Audio("/ok.mp3").play();
      setFlash("ok");
      setTimeout(() => setFlash(null), 300);

      setLogs([
        {
          name: siswa.name,
          kelas: siswa.kelas,
          date: dateString,
          siswaId,
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: "success",
          timestamp,
        },
        ...logs,
      ]);

      setTimeout(() => setLatestSiswaId(null), 1000);
    });
  };

  const filteredLogs = logs.filter((log) =>
    log.name.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const handleUpload = () => {
    setIsLoading(true);
  }

  useEffect(() => {
    setLogCount(logs.length);
    alreadyScan.current = logs.map((l) => l.siswaId.toString());
  }, [logs]);

  return (
    <div className="min-h-screen font-sans pb-24 flex flex-col">
      <Navbar />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* --- KOLOM KIRI: SCANNER --- */}
            <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4 md:sticky md:top-24 h-fit z-10">
              {logCount >= 1 && (
                <div role="alert" className="alert bg-blue-50 text-blue-500">
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
                  <span>{logCount} data menunggu di-upload</span>
                  <button className="btn btn-sm btn-primary" onClick={handleUpload}>Upload</button>
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
                    styles={{
                      container: { width: "100%", height: "100%" },
                      video: {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      },
                    }}
                  />

                  {/* --- 3. OVERLAY FLASH --- */}
                  <div
                    className={`absolute inset-0 z-50 ${
                      flash == "ok" ? "bg-green-400/40" : "bg-red-400/40"
                    } pointer-events-none transition-opacity duration-300 ease-out ${
                      flash ? "opacity-100" : "opacity-0"
                    }`}
                  ></div>

                  {/* Teks Overlay Nama Siswa */}
                  {overlayData && (
                    <div className="absolute bottom-10 left-0 right-0 z-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="inline-block bg-base-100/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-base-200">
                        <p className="text-lg font-bold text-primary">
                          {overlayData[0]}
                        </p>
                        <p className="text-sm font-medium text-base-content/70">
                          {overlayData[1]}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Garis Scan Animasi */}
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary shadow-[0_0_20px_rgba(var(--p),1)] animate-[scan_2s_infinite_linear]"></div>
                </div>
              </div>
            </div>

            {/* --- KOLOM KANAN: RIWAYAT --- */}
            <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-4 rounded-xl shadow-sm border border-base-200 sticky top-[70px] md:static z-20">
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

              <div className="space-y-3 min-h-[300px]">
                {filteredLogs.map((log) => {
                  const isActive = activeSiswaId === log.siswaId;
                  const isNew = latestSiswaId === log.siswaId;

                  return (
                    <div
                      key={log.siswaId}
                      onClick={() => handleRowClick(log.siswaId)}
                      className={`
                        card bg-base-100 shadow-sm border cursor-pointer group
                        transform transition-all duration-300 ease-out
                        ${
                          isNew
                            ? "animate-pop-in bg-primary/10 border-primary"
                            : "animate-in fade-in slide-in-from-top-4"
                        }
                        ${
                          isActive
                            ? "border-primary ring-1 ring-primary"
                            : "border-base-200 hover:border-primary/30"
                        }
                      `}
                    >
                      <div className="card-body p-3 md:p-4 flex flex-row items-center gap-3 md:gap-4">
                        <div
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                            isNew ? "scale-110" : ""
                          } ${
                            log.status === "success"
                              ? "bg-success/10 text-success"
                              : "bg-error/10 text-error"
                          }`}
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

                        <div className="flex-grow min-w-0">
                          <div
                            className={`font-bold text-sm md:text-base truncate transition-colors ${
                              isActive ? "text-primary" : ""
                            }`}
                          >
                            {log.name}
                          </div>
                          <div className="text-xs text-base-content/60 flex items-center gap-2 mt-0.5">
                            <span className="badge badge-xs badge-ghost font-medium">
                              {log.kelas}
                            </span>
                            {isActive && (
                              <span className="text-[10px] text-base-content/40 animate-pulse">
                                Ketuk lagi untuk tutup
                              </span>
                            )}
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
