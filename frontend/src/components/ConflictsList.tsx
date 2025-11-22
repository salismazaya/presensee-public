import { useState, useEffect } from "react";
import {
  getConflictsAbsensi,
  insertAbsens,
  purgeConflictAbsensi,
  type InsertAbsensProps,
} from "../helpers/database";
import useDatabase from "../hooks/useDatabase";
import Swal from "sweetalert2";
import useConflicts from "../hooks/useConflicts";
import useLastRefresh from "../hooks/useLastRefresh";

// --- Interfaces ---
export interface ConflictData {
  type: string;
  absensi_id: number;
  absensi_siswa: string;
  absensi_date: string;
  absensi_kelas_id: number;
  absensi_siswa_id: number;
  other: {
    display_name: string;
    absensi_status: "hadir" | "sakit" | "izin" | "alfa" | "bolos";
  };
  self: {
    display_name: string;
    absensi_status: "hadir" | "sakit" | "izin" | "alfa" | "bolos";
  };
}

interface ConflictResolverProps {
  conflicts: ConflictData[];
  onSave: (conflicts: InsertAbsensProps[]) => void;
}

// --- Helpers ---
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
};

// Helper untuk mendapatkan class warna button berdasarkan status
const getStatusBtnClass = (status: string, isSelected: boolean) => {
  const s = status.toLowerCase();
  let colorClass = "btn-ghost"; // Default

  if (s === "hadir") colorClass = "btn-success text-white";
  else if (s === "sakit") colorClass = "btn-warning text-black";
  else if (s === "izin") colorClass = "btn-info text-white";
  else if (s === "alfa") colorClass = "btn-error text-white";
  else if (s === "bolos") colorClass = "btn-neutral text-white";

  // Jika tidak dipilih, ubah jadi outline/ghost style tapi tetap bawa warna bordernya
  if (!isSelected) {
    if (s === "hadir") return "btn-outline btn-success bg-base-100";
    if (s === "sakit") return "btn-outline btn-warning bg-base-100";
    if (s === "izin") return "btn-outline btn-info bg-base-100";
    if (s === "alfa") return "btn-outline btn-error bg-base-100";
    if (s === "bolos") return "btn-outline btn-neutral bg-base-100";
    return "btn-outline";
  }

  return colorClass;
};

export function ConflictResolver({ conflicts, onSave }: ConflictResolverProps) {
  // State untuk menyimpan pilihan user: { [absensi_id]: "status_pilihan" }
  const [decisions, setDecisions] = useState<Record<number, string>>({});

  // Reset state jika data conflicts berubah
  useEffect(() => {
    setDecisions({});
  }, [conflicts]);

  // Handle klik pilihan
  const handleSelect = (id: number, status: string) => {
    setDecisions((prev) => ({
      ...prev,
      [id]: status,
    }));
  };

  // Cek apakah semua konflik sudah diselesaikan
  const isAllResolved =
    conflicts.length > 0 && conflicts.every((c) => decisions[c.absensi_id]);

  // Handle Simpan
  const handleSubmit = () => {
    const newAbsensies: InsertAbsensProps[] = [];

    Object.entries(decisions).map(([id, status]) => {
      const conflict = conflicts.find((e) => e.absensi_id == parseInt(id));

      if (conflict) {
        newAbsensies.push({
          date: conflict.absensi_date,
          kelasId: conflict.absensi_kelas_id,
          siswaId: conflict.absensi_siswa_id,
          status: status as any,
          previousStatus: conflict.other.absensi_status,
        });
      }
    });

    onSave(newAbsensies);
  };

  if (conflicts.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-10">
      <div className="alert alert-warning shadow-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h3 className="font-bold">Terdeteksi Data Tabrakan!</h3>
          <div className="text-xs">
            Mohon pilih salah satu status yang benar untuk setiap siswa di bawah
            ini.
          </div>
        </div>
      </div>

      {conflicts.map((item) => {
        const currentSelection = decisions[item.absensi_id];

        return (
          <div
            key={item.absensi_id}
            className={`card bg-base-100 border-2 transition-all duration-300 ${
              currentSelection
                ? "border-success shadow-none"
                : "border-warning shadow-md"
            }`}
          >
            <div className="card-body p-4 md:p-6">
              {/* Header Card */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-base-200 pb-3 mb-3 gap-2">
                <div>
                  <div className="font-bold text-lg text-primary">
                    {item.absensi_siswa}
                  </div>
                  <div className="text-xs uppercase tracking-wider opacity-60 font-semibold">
                    {formatDate(item.absensi_date)}
                  </div>
                </div>
                {!currentSelection && (
                  <span className="badge badge-warning badge-sm animate-pulse">
                    Butuh Tindakan
                  </span>
                )}
                {currentSelection && (
                  <span className="badge badge-success badge-sm text-white">
                    Terpilih
                  </span>
                )}
              </div>

              {/* Pilihan Action Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A (Other) */}
                <button
                  onClick={() =>
                    handleSelect(item.absensi_id, item.other.absensi_status)
                  }
                  className={`btn h-auto py-3 flex flex-col items-start gap-1 normal-case text-left border-2 ${getStatusBtnClass(
                    item.other.absensi_status,
                    currentSelection === item.other.absensi_status
                  )}`}
                >
                  <span className="text-xs opacity-80 font-normal">
                    Pilihan {item.other.display_name}:
                  </span>
                  <span className="text-lg font-bold uppercase">
                    {item.other.absensi_status}
                  </span>
                </button>

                {/* Option B (Self) */}
                <button
                  onClick={() =>
                    handleSelect(item.absensi_id, item.self.absensi_status)
                  }
                  className={`btn h-auto py-3 flex flex-col items-start gap-1 normal-case text-left border-2 ${getStatusBtnClass(
                    item.self.absensi_status,
                    currentSelection === item.self.absensi_status
                  )}`}
                >
                  <span className="text-xs opacity-80 font-normal">
                    Pilihan Anda:
                  </span>
                  <span className="text-lg font-bold uppercase">
                    {item.self.absensi_status}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Floating / Fixed Save Button */}
      <div className="pt-4">
        <button
          onClick={handleSubmit}
          disabled={!isAllResolved}
          className="btn btn-primary w-full btn-lg shadow-xl"
        >
          {isAllResolved
            ? `Simpan ${conflicts.length} Perubahan`
            : `Selesaikan ${
                conflicts.length - Object.keys(decisions).length
              } Tabrakan Lagi`}
        </button>
      </div>
    </div>
  );
}

export default function ConflictsList() {
  const [conflicts, setConflicts] = useConflicts();
  const db = useDatabase();
  const [show, setShow] = useState(true);
  const [lastRefresh] = useLastRefresh()

  useEffect(() => {
    if (setConflicts) {
      setConflicts(getConflictsAbsensi());
    }
  }, [setConflicts, lastRefresh]);


  const handleSave = (conflicts: InsertAbsensProps[]) => {
    insertAbsens(db, conflicts);
    purgeConflictAbsensi();
    setShow(false);

    Swal.fire({
      title: "Sukses",
      // text: "Silahkan upload jika sedang tersedia internet",
      icon: "success",
    }).finally(() => {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
  };

  return (
    show && (
      <ConflictResolver
        conflicts={conflicts}
        onSave={handleSave}
      ></ConflictResolver>
    )
  );
}
