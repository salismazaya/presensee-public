import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useNavigate, useParams } from "react-router";
import useDatabase from "../hooks/useDatabase";
import {
  getAbsensies,
  getIsLocked,
  getKelas,
  getSiswa,
  insertAbsens,
  type AbsensiProps,
  type SiswaProps,
} from "../helpers/database";
import useKelas from "../hooks/useKelas";
import useUser from "../hooks/useUser";
import { type InsertAbsensProps } from "../helpers/stagingDatabase";
import Swal from "sweetalert2";

// Helper untuk format tanggal header
function formatDisplayDate(dateStr: string | undefined) {
  if (!dateStr) return "";
  const [d, m, y] = dateStr.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${monthNames[parseInt(m) - 1]} 20${y}`;
}

export default function AbsensiDetail() {
  const { absen_id } = useParams();
  const db = useDatabase();

  const [siswas, setSiswas] = useState<SiswaProps[]>([]);
  const [locked, setLocked] = useState<boolean>(false);
  const [absensies, setAbsensies] = useState<AbsensiProps[]>([]);
  const [filteredAbsensies, setFilteredAbsensies] = useState<AbsensiProps[]>([]);
  const [kelas] = useKelas();
  const [kelasName, setKelasName] = useState("");
  const [user] = useUser();
  const [query, setQuery] = useState<string>("");
  const navigate = useNavigate();

  // --- LOGIC HANDLERS --- (Tetap sama, hanya sedikit refactor jika perlu)
  const handleClick = (
    siswa_id: number,
    status: "hadir" | "alfa" | "sakit" | "izin" | "bolos"
  ) => {
    const absensi = absensies.find((x) => x.siswa_id == siswa_id);
    if (absensi) {
      // Optimistic UI update pada state lokal absensies
      const updatedAbsensies = absensies.map(a => 
        a.siswa_id === siswa_id ? { ...a, status: status } : a
      );
      setAbsensies(updatedAbsensies);
    }
  };

  const handleHadirAll = async () => {
    const newAbsensies: AbsensiProps[] = absensies.map((absensi) => {
      return { ...absensi, status: "hadir" };
    });
    setAbsensies(newAbsensies);
  };

  const handleSave = async (kelas: number, date: string) => {
    const absensiesToSave: InsertAbsensProps[] = absensies
      .map((x) => {
        if (x.status) {
          return {
            siswaId: x.siswa_id,
            kelasId: kelas,
            status: x.status,
            date,
          };
        }
      })
      .filter((x): x is InsertAbsensProps => x !== undefined);

    const siswasTidakHadir = absensies
      .filter((a) => a.status && a.status !== "hadir")
      .map((a) => {
        const siswa = getSiswa({ db, whereQuery: "id=" + a.siswa_id })[0];
        let statusColor = "text-error";
        if (a.status == "sakit") statusColor = "text-warning";
        if (a.status == "izin") statusColor = "text-info";

        return `<div class="flex justify-between border-b border-base-200 py-1">
            <span class="font-medium">${siswa.fullname}</span>
            <span class="${statusColor} font-bold uppercase">${a.status}</span>
        </div>`;
      });

    const html = siswasTidakHadir.length > 0 
        ? `<div class="text-left text-sm max-h-60 overflow-y-auto">${siswasTidakHadir.join("")}</div>`
        : `<p class="text-success font-bold">Semua siswa Hadir!</p>`;

    Swal.fire({
      title: "Konfirmasi Absensi",
      html,
      icon: siswasTidakHadir.length > 0 ? "warning" : "info",
      showCancelButton: true,
      confirmButtonText: "Simpan Data",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3b82f6", // Primary Blue
    }).then(async (result) => {
      if (result.isConfirmed) {
          insertAbsens(db, absensiesToSave);
          Swal.fire({
            title: "Tersimpan!",
            text: "Data absensi berhasil disimpan.",
            icon: "success",
            timer: 1500,
            showConfirmButton: false
          });
          navigate("/absensi");
      }
    });
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (db && kelas) {
      const allSiswas = getSiswa({ db, whereQuery: `kelas_id=${kelas}` });
      const currentKelas = getKelas({ db, whereQuery: `id=${kelas}` });
      if (currentKelas.length >= 1) setKelasName(currentKelas[0].name);
      setTimeout(() => setSiswas(allSiswas), 300); // Sedikit delay agar tidak blocking UI render awal
    }
  }, [db, kelas]);

  useEffect(() => {
    if (db && kelas && absen_id && user) {
      let isLocked = getIsLocked({ db, date: absen_id, kelas_id: kelas });
      isLocked = isLocked || (user !== undefined && user.type === "kesiswaan");
      setLocked(isLocked);
    }
  }, [db, kelas, user, absen_id]);

  useEffect(() => {
    if (db && siswas.length >= 1 && absen_id?.split("-").length === 3 && kelas) {
      const [dd, mm, yy] = absen_id.split("-");
      // Fetch data existing dari DB
      const currentAbsensies = getAbsensies({
        db,
        sql: `SELECT a.id AS absensi_id, a.status, s.id AS siswa_id
              FROM siswa AS s
              LEFT JOIN absensi AS a ON a.siswa_id = s.id AND DATE(a.date) = "20${yy}-${mm}-${dd}"
              WHERE s.kelas_id = ${kelas};`,
      });

      // Merge dengan list siswa (agar siswa yang belum absen tetap muncul)
      let mergedAbsensies = siswas.map(siswa => {
        const existing = currentAbsensies.find(a => a.siswa_id === siswa.id);
        return existing ? { ...existing, siswa_id: siswa.id } : { siswa_id: siswa.id };
      });

      // Sort alphabetically
      mergedAbsensies.sort((a, b) => {
        const nameA = siswas.find(s => s.id === a.siswa_id)?.fullname || "";
        const nameB = siswas.find(s => s.id === b.siswa_id)?.fullname || "";
        return nameA.localeCompare(nameB);
      });

      setAbsensies(mergedAbsensies);
    }
  }, [siswas, kelas, absen_id, db]);

  useEffect(() => {
    if (!query) {
      setFilteredAbsensies(absensies);
    } else {
      const lowerQuery = query.toLowerCase();
      setFilteredAbsensies(absensies.filter((a) => {
        const name = siswas.find((s) => s.id === a.siswa_id)?.fullname || "";
        return name.toLowerCase().includes(lowerQuery);
      }));
    }
  }, [absensies, query, siswas]);


  // --- RENDER COMPONENTS ---
  
  // Konfigurasi tombol opsi
  const statusOptions = [
    { val: "hadir", label: "H", colorClass: "text-success", activeClass: "bg-green-100 text-success", labelFull: "Hadir" },
    { val: "sakit", label: "S", colorClass: "text-warning", activeClass: "bg-yellow-100 text-warning", labelFull: "Sakit" },
    { val: "izin",  label: "I", colorClass: "text-info",    activeClass: "bg-blue-100 text-info",       labelFull: "Izin" },
    { val: "alfa",  label: "A", colorClass: "text-error",   activeClass: "bg-red-100 text-error",     labelFull: "Alfa" },
    { val: "bolos", label: "B", colorClass: "text-error", activeClass: "bg-red-200 text-error", labelFull: "Bolos" },
  ];

  return (
    <div className="min-h-screen bg-base-200 pb-24 font-sans"> {/* pb-24 memberi ruang untuk footer & save button */}
      <Navbar />

      {/* STICKY HEADER & SEARCH */}
      <div className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-md border-b border-base-300 shadow-sm">
         <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex flex-row justify-between items-center mb-3">
                <div>
                    <h2 className="text-xs font-bold text-base-content/50 uppercase tracking-widest">Absensi Kelas</h2>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">{kelasName}</span>
                        <span className="text-sm font-medium opacity-70">/ {formatDisplayDate(absen_id)}</span>
                    </div>
                </div>
                {!locked && (
                    <button onClick={handleHadirAll} className="btn btn-sm btn-outline btn-success">
                        Hadir Semua
                    </button>
                )}
            </div>
            
            {/* Search Input */}
            <label className="input input-bordered input-sm md:input-md flex items-center gap-2 rounded-xl bg-base-200/50 focus-within:bg-base-100 focus-within:border-primary transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-70"><path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" /></svg>
                <input 
                    type="text" 
                    className="grow" 
                    placeholder="Cari nama siswa..." 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </label>
         </div>
      </div>

      {/* LIST SISWA */}
      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-3">
        {filteredAbsensies.map((absensi) => {
            const siswa = siswas.find((x) => absensi.siswa_id == x.id);
            if(!siswa) return null;

            // Determine Status Badge
            let currentStatusObj = statusOptions.find(o => o.val === absensi.status);
            let cardBorder = "border-l-4 border-l-base-300"; // Default
            if(absensi.status === 'hadir') cardBorder = "border-l-4 border-l-success";
            if(absensi.status === 'sakit') cardBorder = "border-l-4 border-l-warning";
            if(absensi.status === 'izin') cardBorder = "border-l-4 border-l-info";
            if(absensi.status === 'alfa') cardBorder = "border-l-4 border-l-error";
            if(absensi.status === 'bolos') cardBorder = "border-l-4 border-l-neutral";

            return (
                <div key={siswa.id} className={`card bg-base-100 shadow-sm rounded-lg overflow-hidden border border-base-200 ${cardBorder}`}>
                    <div className="card-body p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        {/* Nama & Status Text */}
                        <div className="flex-grow">
                            <h3 className="font-bold text-lg leading-tight">{siswa.fullname}</h3>
                            <p className="text-xs text-base-content/60 mt-1 uppercase tracking-wide">
                                Status: 
                                {absensi.status ? (
                                    <span className={`ml-1 font-bold ${currentStatusObj?.activeClass.split(" ")[1] || ""}`}>
                                        {currentStatusObj?.labelFull}
                                    </span>
                                ) : (
                                    <span className="ml-1 italic">Belum diabsen</span>
                                )}
                            </p>
                        </div>

                        {/* Button Group Actions */}
                        <div className="flex-shrink-0">
                             {/* Mobile: Grid kecil, Desktop: Flex row */}
                             <div className="join w-full grid grid-cols-5 md:flex shadow-sm">
                                {statusOptions.map((opt, i) => (
                                    <button
                                        key={opt.val + i}
                                        disabled={locked}
                                        onClick={() => handleClick(siswa.id, opt.val as any)}
                                        className={`
                                            join-item btn btn-sm md:btn-md flex-1
                                            ${absensi.status === opt.val ? opt.activeClass : "btn-ghost bg-base-200/50 hover:bg-base-200"}
                                            ${locked ? "opacity-50 cursor-not-allowed" : opt.colorClass}
                                            border-base-300
                                        `}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                             </div>
                        </div>

                    </div>
                </div>
            );
        })}
      </div>

      {/* FLOATING SAVE ACTION BAR */}
      {!locked && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-base-100/90 backdrop-blur-lg border-t border-base-300 z-40 flex justify-center pb-safe">
             <div className="max-w-3xl w-full flex justify-between items-center gap-4">
                <div className="text-xs text-base-content/60 hidden md:block">
                    Pastikan semua data sudah benar sebelum menyimpan.
                </div>
                <button
                    className="btn btn-primary w-full md:w-auto md:px-10 shadow-lg hover:scale-[1.02] transition-transform"
                    onClick={() => kelas && absen_id && handleSave(kelas, absen_id)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Simpan Absensi
                </button>
             </div>
          </div>
      )}
      
      {/* Add spacing for bottom nav if needed, but save bar usually sits on top of it or replaces it */}
      {locked && <div className="mb-20"><Footer /></div>} 
    </div>
  );
}