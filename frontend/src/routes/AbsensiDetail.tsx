import { useEffect, useRef, useState } from "react";
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
import { type InsertAbsensProps } from "../helpers/database";
import Swal from "sweetalert2";
import useToken from "../hooks/useToken";
import { getAbsensi } from "../helpers/api";
import { toast } from "react-toastify";
import useGlobalLoading from "../hooks/useGlobalLoading";

// Helper untuk format tanggal header
function formatDisplayDate(date: Date) {
  // if (!dateStr) return "";
  // const [d, m, y] = dateStr.split("-");

  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();

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
  return `${d} ${monthNames[m - 1]} ${y}`;
}

export default function AbsensiDetail() {
  const { absen_id } = useParams();
  const db = useDatabase();

  const [siswas, setSiswas] = useState<SiswaProps[]>([]);
  const [locked, setLocked] = useState<boolean>(false);
  const [absensies, setAbsensies] = useState<AbsensiProps[]>([]);
  const [filteredAbsensies, setFilteredAbsensies] = useState<AbsensiProps[]>(
    []
  );
  const [kelas] = useKelas();
  const [token] = useToken();
  const [kelasName, setKelasName] = useState("");
  const [user] = useUser();
  const [query, setQuery] = useState<string>("");
  const navigate = useNavigate();

  const [, setIsLoading] = useGlobalLoading();

  const statusSiswaChangedRef = useRef<number[]>([]);

  const handleClick = (
    siswa_id: number,
    status: "hadir" | "alfa" | "sakit" | "izin" | "bolos"
  ) => {
    const absensi = absensies.find((x) => x.siswaId == siswa_id);
    if (absensi) {
      if (!statusSiswaChangedRef.current.includes(siswa_id)) {
        statusSiswaChangedRef.current.push(siswa_id);
      }

      const updatedAbsensies = absensies.map((a) =>
        a.siswaId === siswa_id ? { ...a, status: status } : a
      );
      setAbsensies(updatedAbsensies);
    }
  };

  const handleHadirAll = async () => {
    siswas.forEach((siswa) => {
      if (!statusSiswaChangedRef.current.includes(siswa.id)) {
        statusSiswaChangedRef.current.push(siswa.id);
      }
    });

    const newAbsensies: AbsensiProps[] = absensies.map((absensi) => {
      return { ...absensi, status: "hadir" };
    });
    setAbsensies(newAbsensies);
  };

  const handleSave = async (kelas: number, date: string) => {
    const siswasTidakHadir: string[] = [];

    const absensiesToSave: InsertAbsensProps[] = absensies
      .map((x) => {
        if (!statusSiswaChangedRef.current.includes(x.siswaId)) {
          return;
        }

        if (x.status != "hadir") {
          const siswa = getSiswa({ db, whereQuery: "id=" + x.siswaId })[0];

          if (x.status) {
            let statusColor = "text-error";
            if (x.status == "sakit") statusColor = "text-warning";
            if (x.status == "izin") statusColor = "text-info";

            const tidakHadir = `<div class="flex justify-between border-b border-base-200 py-1">
            <span class="font-medium">${siswa.fullname}</span>
            <span class="${statusColor} font-bold uppercase">${x.status}</span>
        </div>`;

            siswasTidakHadir.push(tidakHadir);
          } else {
            const tidakHadir = `<div class="flex justify-between border-b border-base-200 py-1">
            <span class="font-medium">${siswa.fullname}</span>
            <span class="font-bold uppercase">BELUM DIABSEN</span>
        </div>`;

            siswasTidakHadir.push(tidakHadir);
          }
        }

        if (x.status) {
          return {
            siswaId: x.siswaId,
            kelasId: kelas,
            status: x.status,
            date,
          };
        }
      })
      .filter((x): x is InsertAbsensProps => x !== undefined);

    const html =
      siswasTidakHadir.length > 0
        ? `<div class="text-left text-sm max-h-60 overflow-y-auto">${siswasTidakHadir.join(
            ""
          )}</div>`
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
          showConfirmButton: false,
        });
        navigate("/absensi");
      }
    });
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (db && kelas) {
      const allSiswas = getSiswa({ db, whereQuery: `kelas_id=${kelas}` });
      // const currentKelas = getKelas({ db, whereQuery: `id=${kelas}` });
      getKelas({ db, whereQuery: `id=${kelas}` }).then((currentKelas) => {
        if (currentKelas.length >= 1) setKelasName(currentKelas[0].name);
      });

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
    if (db && siswas.length >= 1 && absen_id && kelas) {
      const datetime = new Date(absen_id);

      const dd = datetime.getDate();
      const mm = datetime.getMonth() + 1;
      const yy = datetime.getFullYear() % 2000;

      // Pastikan yy adalah 2 digit akhir tahun (misal: 25)
      // Pastikan mm dan dd sudah berupa string atau number yang benar

      // Teknik Zero-Padding
      const year = `20${yy}`;
      const month = String(mm).padStart(2, "0"); // Mengubah 9 menjadi "09"
      const day = String(dd).padStart(2, "0"); // Mengubah 5 menjadi "05"

      const sql = `
  SELECT 
    a.id AS absensi_id, 
    a.status, 
    s.id AS siswa_id, 
    IFNULL(a.status, 'belum absen') AS status_display -- Opsi tambahan
  FROM siswa AS s
  LEFT JOIN absensi AS a 
    ON a.siswa_id = s.id 
    AND a.date = '${year}-${month}-${day}' -- Gunakan single quote
  WHERE s.kelas_id = ${kelas};
`;

      const currentAbsensies = getAbsensies({
        db,
        sql,
      });

      // Merge dengan list siswa (agar siswa yang belum absen tetap muncul)
      let mergedAbsensies = siswas.map((siswa) => {
        const existing = currentAbsensies.find((a) => a.siswaId == siswa.id);

        // Jika siswa belum di absen maka daftarkan ke absen siswa yang akan diubah
        if (!existing?.status) {
          statusSiswaChangedRef.current.push(siswa.id);
        }

        return existing
          ? { ...existing, siswaId: siswa.id }
          : { siswaId: siswa.id };
      });

      // Sort alphabetically
      mergedAbsensies.sort((a, b) => {
        const nameA = siswas.find((s) => s.id === a.siswaId)?.fullname || "";
        const nameB = siswas.find((s) => s.id === b.siswaId)?.fullname || "";
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
      setFilteredAbsensies(
        absensies.filter((a) => {
          const name = siswas.find((s) => s.id === a.siswaId)?.fullname || "";
          return name.toLowerCase().includes(lowerQuery);
        })
      );
    }
  }, [absensies, query, siswas]);

  const dataServerLoaded = useRef(false);

  // fetch data dari server
  useEffect(() => {
    if (dataServerLoaded.current) return;
    if (token && absen_id && kelas && absensies.length >= 1) {
      setIsLoading(true);

      // anggap maksimal delay dari server itu 2 detik
      // Ini untuk mendeteksi user sedang offline
      const offlineDetectTimeout = setTimeout(() => {
        setIsLoading(false);
      }, 2000);

      getAbsensi(token, absen_id, kelas)
        .then((res) => {
          dataServerLoaded.current = true;

          const newAbsensies = absensies.map((a) => {
            const newStatus = a.status || res[a.siswaId] || undefined;
            return {
              ...a,
              status: newStatus,
            };
          });

          setAbsensies(newAbsensies);

          toast.success("Menerima data dari server", {
            autoClose: 1000,
            closeOnClick: true,
          });
        })
        .finally(() => {
          setIsLoading(false);
          clearTimeout(offlineDetectTimeout);
        });
    }
  }, [token, kelas, absensies]);

  // --- RENDER COMPONENTS ---

  // Konfigurasi tombol opsi
  const statusOptions = [
    {
      val: "hadir",
      label: "H",
      colorClass: "text-success",
      activeClass: "bg-green-100 text-success",
      labelFull: "Hadir",
    },
    {
      val: "sakit",
      label: "S",
      colorClass: "text-warning",
      activeClass: "bg-yellow-100 text-warning",
      labelFull: "Sakit",
    },
    {
      val: "izin",
      label: "I",
      colorClass: "text-info",
      activeClass: "bg-blue-100 text-info",
      labelFull: "Izin",
    },
    {
      val: "alfa",
      label: "A",
      colorClass: "text-error",
      activeClass: "bg-red-100 text-error",
      labelFull: "Alfa",
    },
    {
      val: "bolos",
      label: "B",
      colorClass: "text-error",
      activeClass: "bg-red-200 text-error",
      labelFull: "Bolos",
    },
  ];

  return (
    <div className="min-h-screen bg-base-200 pb-24 font-sans">
      {" "}
      {/* pb-24 memberi ruang untuk footer & save button */}
      <Navbar />
      {/* STICKY HEADER & SEARCH */}
      <div className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-md border-b border-base-300 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex flex-row justify-between items-center mb-3">
            <div>
              <h2 className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                Absensi Kelas
              </h2>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary">
                  {kelasName}
                </span>
                <span className="text-sm font-medium opacity-70">
                  / {absen_id && formatDisplayDate(new Date(absen_id))}
                </span>
              </div>
            </div>
            {!locked && (
              <button
                onClick={handleHadirAll}
                className="btn btn-sm btn-outline btn-success"
              >
                Hadir Semua
              </button>
            )}
          </div>

          {/* Search Input */}
          <label className="input input-bordered input-sm md:input-md flex items-center gap-2 rounded-xl bg-base-200/50 focus-within:bg-base-100 focus-within:border-primary transition-all">
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
          const siswa = siswas.find((x) => absensi.siswaId == x.id);

          if (!siswa) return null;

          // Determine Status Badge
          let currentStatusObj = statusOptions.find(
            (o) => o.val === absensi.status
          );
          let cardBorder = "border-l-4 border-l-base-300"; // Default
          if (absensi.status === "hadir")
            cardBorder = "border-l-4 border-l-success";
          if (absensi.status === "sakit")
            cardBorder = "border-l-4 border-l-warning";
          if (absensi.status === "izin")
            cardBorder = "border-l-4 border-l-info";
          if (absensi.status === "alfa")
            cardBorder = "border-l-4 border-l-error";
          if (absensi.status === "bolos")
            cardBorder = "border-l-4 border-l-neutral";

          return (
            <div
              key={siswa.id}
              className={`card bg-base-100 shadow-sm rounded-lg overflow-hidden border border-base-200 ${cardBorder}`}
            >
              <div className="card-body p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Nama & Status Text */}
                <div className="grow">
                  <h3 className="font-bold text-lg leading-tight">
                    {siswa.fullname}
                  </h3>
                  <p className="text-xs text-base-content/60 mt-1 uppercase tracking-wide">
                    Status:
                    {absensi.status ? (
                      <span
                        className={`ml-1 font-bold ${
                          currentStatusObj?.activeClass.split(" ")[1] || ""
                        }`}
                      >
                        {currentStatusObj?.labelFull}
                      </span>
                    ) : (
                      <span className="ml-1 italic">Belum diabsen</span>
                    )}
                  </p>
                </div>

                {/* Button Group Actions */}
                <div className="shrink-0">
                  {/* Mobile: Grid kecil, Desktop: Flex row */}
                  <div className="join w-full grid grid-cols-5 md:flex shadow-sm">
                    {statusOptions.map((opt, i) => (
                      <button
                        key={opt.val + i}
                        disabled={locked}
                        onClick={() => handleClick(siswa.id, opt.val as any)}
                        className={`
                                            join-item btn btn-sm md:btn-md flex-1
                                            ${
                                              absensi.status === opt.val
                                                ? opt.activeClass
                                                : "btn-ghost bg-base-200/50 hover:bg-base-200"
                                            }
                                            ${
                                              locked
                                                ? "opacity-50 cursor-not-allowed"
                                                : opt.colorClass
                                            }
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
              Simpan Absensi
            </button>
          </div>
        </div>
      )}
      {/* Add spacing for bottom nav if needed, but save bar usually sits on top of it or replaces it */}
      {locked && (
        <div className="mb-20">
          <Footer />
        </div>
      )}
    </div>
  );
}
