import React, { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import Rekap from "../components/Rekap";
import { DayPicker } from "react-day-picker";
import { getKelas, type KelasProps } from "../helpers/database";
import { getAnalyticsData, type AnalyticsData } from "../helpers/analytics";
import useDatabase from "../hooks/useDatabase";
import "react-day-picker/style.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Users,
  TrendingUp,
  AlertCircle,
  UserX,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import useUser from "../hooks/useUser";


const COLORS = {
  hadir: "#22c55e", // success
  sakit: "#eab308", // warning
  izin: "#3b82f6",  // info
  alpha: "#ef4444", // error
  bolos: "#a855f7", // purple (NEW)
  bg: "#1d232a",
};

// ... (kode fungsi formatDateForDB tetap sama) ...
const formatDateForDB = (date: Date) => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `"${y}-${m}-${d}"`;
};

export default function RekapRoute() {
  const [ordering, setOrdering] = useState<"DESC" | "ASC">("DESC");
  const [showAdvanceQuery, setShowAdvanceQuery] = useState(false);
  const [kelasId, setKelasId] = useState<number>();

  const [startDate, setStartDate] = useState<string>("date('now', 'start of month')");
  const [endDate, setEndDate] = useState<string>("date('now')");

  const [startDatePicker, setStartDatePicker] = useState<Date>();
  const [endDatePicker, setEndDatePicker] = useState<Date>();

  const db = useDatabase();
  const [user] = useUser()
  const [kelass, setKelass] = useState<KelasProps[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!db) return;
    setKelass(getKelas({ db }));
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const data = getAnalyticsData(db, startDate, endDate, kelasId);
    setAnalytics(data);
  }, [db, startDate, endDate, kelasId]);

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
      setStartDate("date('now', 'start of month')");
      setEndDate("date('now')");
    } else if (value == "days15") {
      setStartDate("date('now', '-15 days')");
      setEndDate("date('now')");
    } else if (value == "week") {
      setStartDate("date('now', 'weekday 1', '-7 days')");
      setEndDate('date("now")');
    } else if (value == "all") {
      setStartDate('"2024-01-01"');
      setEndDate('date("now")');
    }
  }

  // --- KOMPONEN KARTU STATISTIK ---
  const StatCard = ({ title, value, icon, color, desc, textColor }: any) => (
    <div className="stats shadow bg-base-100 border border-base-200">
      <div className="stat">
        <div className={`stat-figure ${textColor || `text-${color}`}`}>
          {icon}
        </div>
        <div className="stat-title">{title}</div>
        <div className={`stat-value ${textColor || `text-${color}`}`}>{value}</div>
        <div className="stat-desc">{desc}</div>
      </div>
    </div>
  );

  const InsightCard = ({ title, day, percentage, type }: { title: string, day: string, percentage: number, type: 'good' | 'bad' }) => (
    <div className={`card shadow-lg border border-base-200 ${type === 'good' ? 'bg-success/10' : 'bg-error/10'}`}>
      <div className="card-body p-4 flex flex-row items-center justify-between">
        <div>
          <h3 className="card-title text-base opacity-70">{title}</h3>
          <div className="mt-2">
            <span className="text-2xl font-bold uppercase">{day}</span>
            <span className={`ml-2 badge ${type === 'good' ? 'badge-success' : 'badge-error'} badge-lg`}>
              {percentage}% Hadir
            </span>
          </div>
        </div>
        <div className={`p-3 rounded-full ${type === 'good' ? 'bg-success text-white' : 'bg-error text-white'}`}>
          {type === 'good' ? <ThumbsUp size={24} /> : <ThumbsDown size={24} />}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      <main className="flex-grow p-4 md:p-8 space-y-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* HEADER & FILTERS tetap sama ... */}
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            {/* ... Code header & filter tidak berubah ... */}
            <div>
              <h1 className="text-3xl font-bold text-base-content flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-primary" />
                Dashboard Absensi
              </h1>
              <p className="text-base-content/60">
                Analitik performa kehadiran siswa real-time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select onChange={handleDateChange} className="select select-bordered select-sm">
                <option value="month">Bulan Ini</option>
                <option value="week">Minggu Ini</option>
                <option value="days15">15 Hari Terakhir</option>
                <option value="all">Semua Data</option>
                <option value="custom">Pilih Tanggal</option>
              </select>

              <select onChange={handleKelasChange} className="select select-bordered select-sm">
                <option value="all">Semua Kelas</option>
                {kelass.map((k) => (
                  <option key={k.id} value={k.id.toString()}>{k.name}</option>
                ))}
              </select>
            </div>
          </div>

          {showAdvanceQuery && (
            <div className="bg-base-100 p-4 rounded-box shadow-sm border border-base-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col md:flex-row justify-center gap-4">
                <div>
                  <p className="text-center font-bold mb-2">Mulai</p>
                  <DayPicker mode="single" selected={startDatePicker} onSelect={setStartDatePicker} className="border rounded-md p-2" />
                </div>
                <div>
                  <p className="text-center font-bold mb-2">Sampai</p>
                  <DayPicker mode="single" selected={endDatePicker} onSelect={setEndDatePicker} className="border rounded-md p-2" />
                </div>
              </div>
            </div>
          )}

          {/* 1. SECTION SUMMARY CARDS (UPDATED) */}
          {analytics && (
            // Grid diubah ke lg:grid-cols-5 agar muat kartu Bolos
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Kehadiran"
                value={`${analytics.summary.attendanceRate}%`}
                desc="Persentase Hadir"
                color="primary"
                icon={<Users className="w-8 h-8" />}
              />
              <StatCard
                title="Hadir"
                value={analytics.summary.totalHadir}
                desc="Siswa masuk"
                color="success"
                icon={<div className="badge badge-success badge-lg">H</div>}
              />
              <StatCard
                title="Absen"
                // Hitung total tidak hadir (S + I + A + B)
                value={
                  analytics.summary.totalSakit +
                  analytics.summary.totalIzin +
                  analytics.summary.totalAlpha +
                  analytics.summary.totalBolos
                }
                desc="Total ketidakhadiran"
                color="warning"
                icon={<AlertCircle className="w-8 h-8" />}
              />
              <StatCard
                title="Alfa"
                value={analytics.summary.totalAlpha}
                desc="Tanpa Keterangan"
                color="error"
                icon={<div className="badge badge-error badge-lg">A</div>}
              />

              {/* KARTU BARU: BOLOS */}
              <StatCard
                title="Bolos"
                value={analytics.summary.totalBolos}
                desc="Meninggalkan kelas"
                textColor="text-purple-500" // Custom color class tailwind jika ada
                icon={<UserX className="w-8 h-8 text-purple-500" />}
              />
            </div>
          )}

          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InsightCard
                title="Hari Paling Produktif"
                day={analytics.insights.mostProductiveDay.day}
                percentage={analytics.insights.mostProductiveDay.percentage}
                type="good"
              />
              <InsightCard
                title="Hari Kurang Produktif"
                day={analytics.insights.leastProductiveDay.day}
                percentage={analytics.insights.leastProductiveDay.percentage}
                type="bad"
              />
            </div>
          )}

          {/* 2. SECTION CHARTS (UPDATED PIE CHART) */}
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Chart Trend Harian */}
              <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-2 border border-base-200">
                <div className="card-body p-4">
                  <h2 className="card-title text-sm opacity-70 mb-4">Tren Kehadiran Harian</h2>
                  <div className="w-full min-w-0">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={analytics.trend}>
                        {/* ... Defs & Gradients sama ... */}
                        <defs>
                          <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.hadir} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={COLORS.hadir} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorAbsen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.alpha} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={COLORS.alpha} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip
                          contentStyle={{ backgroundColor: COLORS.bg, borderRadius: '8px', border: 'none' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="hadir" stroke={COLORS.hadir} fillOpacity={1} fill="url(#colorHadir)" name="Hadir" />
                        <Area type="monotone" dataKey="tidak_hadir" stroke={COLORS.alpha} fillOpacity={1} fill="url(#colorAbsen)" name="Tidak Hadir" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Chart Distribusi */}
              <div className="card bg-base-100 shadow-xl border border-base-200">
                <div className="card-body p-4">
                  <h2 className="card-title text-sm opacity-70 mb-4">Komposisi Absensi</h2>
                  <div className="w-full min-w-0 relative">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Hadir', value: analytics.summary.totalHadir },
                            { name: 'Sakit', value: analytics.summary.totalSakit },
                            { name: 'Izin', value: analytics.summary.totalIzin },
                            { name: 'Alfa', value: analytics.summary.totalAlpha },
                            { name: 'Bolos', value: analytics.summary.totalBolos },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell key="cell-0" fill={COLORS.hadir} />
                          <Cell key="cell-1" fill={COLORS.sakit} />
                          <Cell key="cell-2" fill={COLORS.izin} />
                          <Cell key="cell-3" fill={COLORS.alpha} />
                          <Cell key="cell-4" fill={COLORS.bolos} />
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="absolute inset-0 top-[-30px] flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <span className="text-3xl font-bold">{analytics.summary.attendanceRate}%</span>
                        <p className="text-xs opacity-50">Hadir</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart Ranking Kelas (Tetap sama) */}
              {user?.type == "kesiswaan" && !kelasId && analytics.classPerformance.length > 0 && (
                <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-3 border border-base-200">
                  <div className="card-body p-4">
                    <h2 className="card-title text-sm opacity-70">Top 5 Kelas Terajin</h2>
                    <div className="w-full min-w-0">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.classPerformance} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="percentage" fill={COLORS.hadir} radius={[0, 4, 4, 0]} barSize={20} name="Persentase Kehadiran (%)">
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. SECTION DETAILED TABLE (Tetap sama) */}
          <div className="divider">DATA MENTAH</div>
          {/* ... sisa kode di bawah sama ... */}
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Rincian Data</h3>
            <select
              onChange={(e) => setOrdering(e.target.value as "DESC" | "ASC")}
              className="select select-bordered select-xs"
            >
              <option value="DESC">Paling rajin</option>
              <option value="ASC">Palin bermasalah</option>
            </select>
          </div>

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