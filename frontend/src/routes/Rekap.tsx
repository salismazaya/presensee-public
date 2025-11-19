import React, { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import Rekap from "../components/Rekap";
import { DayPicker } from "react-day-picker";
import { getKelas, type KelasProps } from "../helpers/database";
import useDatabase from "../hooks/useDatabase";
import "react-day-picker/style.css";

// Format date helper YYYY-MM-DD
const formatDateForDB = (date: Date) => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const value = `"${y}-${m}-${d}"`;
  // console.log({value})
  return value
};

export default function RekapRoute() {
  const [ordering, setOrdering] = useState<"DESC" | "ASC">("DESC");
  const [showAdvanceQuery, setShowAdvanceQuery] = useState(false);
  const [kelasId, setKelasId] = useState<number>();
  const [startDate, setStartDate] = useState<string>();
  const [endDate, setEndDate] = useState<string>();

  // Date Picker States
  const [startDatePicker, setStartDatePicker] = useState<Date>();
  const [endDatePicker, setEndDatePicker] = useState<Date>();

  const db = useDatabase();
  const [kelass, setKelass] = useState<KelasProps[]>([]);

  useEffect(() => {
    if (!db) return;
    setKelass(getKelas({ db }));
  }, [db]);

  useEffect(() => {
    if (!startDatePicker || !endDatePicker) return;
    setStartDate(formatDateForDB(startDatePicker));
    setEndDate(formatDateForDB(endDatePicker));
  }, [startDatePicker, endDatePicker]);

  function handleKelasChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "all") {
      setKelasId(undefined);
      return;
    }
    setKelasId(parseInt(value));
  }

  function handleDateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;

    if (value === "custom") {
      setShowAdvanceQuery(true);
      return;
    } else {
      setShowAdvanceQuery(false);
    }

    if (value == "month") {
      setStartDate(undefined);
      setEndDate(undefined);
    } else if (value == "days15") {
      setStartDate("date('now', '-15 days')");
      setEndDate("date('now')");
    } else if (value == "week") {
      setStartDate("date('now', 'weekday 1', '-7 days')");
      setEndDate('date("now")');
    } else if (value == "all") {
      setStartDate('"1970/01/01"');
      setEndDate('date("now")');
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Title */}
          <div>
            <h1 className="text-2xl font-bold text-base-content">
              Rekapitulasi Absensi
            </h1>
            <p className="text-sm text-base-content/60">
              Lihat statistik kehadiran siswa berdasarkan periode waktu.
            </p>
          </div>

          <div className="w-full text-right mt-2"></div>

          {/* FILTER CONTROL CARD */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4 md:p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filter Waktu */}
                <div className="form-control w-full">
                  <label className="label pb-1">
                    <span className="label-text font-semibold text-xs uppercase tracking-wide opacity-70">
                      Periode Waktu
                    </span>
                  </label>
                  <select
                    onChange={handleDateChange}
                    className="select select-bordered w-full bg-base-100"
                  >
                    <option value="month">Bulan Ini</option>
                    <option value="week">Minggu Ini</option>
                    <option value="days15">15 Hari Terakhir</option>
                    <option value="all">Semua Waktu</option>
                    <option value="custom">-- Pilih Tanggal Sendiri --</option>
                  </select>
                </div>

                {/* Filter Kelas */}
                <div className="form-control w-full">
                  <label className="label pb-1">
                    <span className="label-text font-semibold text-xs uppercase tracking-wide opacity-70">
                      Filter Kelas
                    </span>
                  </label>
                  <select
                    onChange={handleKelasChange}
                    className="select select-bordered w-full bg-base-100"
                  >
                    <option value="all">Semua Kelas</option>
                    {kelass.map((k) => (
                      <option key={k.id} value={k.id.toString()}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Urutan */}
                <div className="form-control w-full">
                  <label className="label pb-1">
                    <span className="label-text font-semibold text-xs uppercase tracking-wide opacity-70">
                      Urutkan Persentase
                    </span>
                  </label>
                  <select
                    onChange={(e) =>
                      setOrdering(e.target.value as "DESC" | "ASC")
                    }
                    className="select select-bordered w-full bg-base-100"
                  >
                    <option value="DESC">Tertinggi ke Terendah</option>
                    <option value="ASC">Terendah ke Tertinggi</option>
                  </select>
                </div>
              </div>

              {/* ADVANCED DATE PICKER (Collapsible) */}
              {showAdvanceQuery && (
                <div className="mt-6 pt-6 border-t border-base-200 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col md:flex-row gap-8 justify-center">
                    <div className="bg-base-200/50 p-4 rounded-2xl border border-base-200">
                      <div className="text-center font-bold mb-2 text-primary">
                        Dari Tanggal
                      </div>
                      <DayPicker
                        mode="single"
                        selected={startDatePicker}
                        onSelect={setStartDatePicker}
                        className="bg-base-100 rounded-xl p-2 shadow-sm"
                      />
                    </div>

                    <div className="hidden md:flex items-center text-base-content/30">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-8 h-8"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
                        />
                      </svg>
                    </div>

                    <div className="bg-base-200/50 p-4 rounded-2xl border border-base-200">
                      <div className="text-center font-bold mb-2 text-primary">
                        Sampai Tanggal
                      </div>
                      <DayPicker
                        mode="single"
                        selected={endDatePicker}
                        onSelect={setEndDatePicker}
                        className="bg-base-100 rounded-xl p-2 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="text-center mt-4">
                    <button
                      onClick={() => setShowAdvanceQuery(false)}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      Batal / Tutup Kalender
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DATA TABLE AREA */}
          {/* Dibungkus card agar background tabel menyatu */}
          <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden min-h-[300px]">
            <div className="overflow-x-auto">
              <Rekap
                full={true}
                type="onemonth"
                ordering={ordering}
                kelasId={kelasId}
                startDate={startDate}
                endDate={endDate}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer active="rekap" />
    </div>
  );
}
