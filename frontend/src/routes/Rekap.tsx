import React, {
  useEffect,
  useState,
  useTransition,
  useDeferredValue,
} from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import Rekap from "../components/Rekap";
import { DayPicker } from "react-day-picker";
import { getKelas, type KelasProps } from "../helpers/database";
import { getAnalyticsData, type AnalyticsData } from "../helpers/analytics";
import useDatabase from "../hooks/useDatabase";
import useUser from "../hooks/useUser";
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
  ThumbsDown,
  Calendar,
} from "lucide-react";

// --- CONSTANTS ---
const COLORS = {
  hadir: "#22c55e",
  sakit: "#eab308",
  izin: "#3b82f6",
  alpha: "#ef4444",
  bolos: "#a855f7",
  bg: "#1d232a",
};

const formatDateForDB = (date: Date) => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `"${y}-${m}-${d}"`;
};

const StatCards = React.memo(({ analytics }: { analytics: AnalyticsData }) => {
  const { summary } = analytics;

  const Card = ({ title, value, icon, color, desc, textColor }: any) => (
    <div className="stats shadow bg-base-100 border border-base-200 w-full">
      <div className="stat p-4">
        <div className={`stat-figure ${textColor || `text-${color}`}`}>
          {icon}
        </div>
        <div className="stat-title text-xs uppercase font-bold opacity-60">
          {title}
        </div>
        <div className={`stat-value text-2xl ${textColor || `text-${color}`}`}>
          {value}
        </div>
        <div className="stat-desc text-xs mt-1">{desc}</div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 animate-in fade-in duration-500">
      <Card
        title="Kehadiran"
        value={`${summary.attendanceRate}%`}
        desc="Persentase"
        color="primary"
        icon={<Users size={24} />}
      />
      <Card
        title="Hadir"
        value={summary.totalHadir}
        desc="Siswa masuk"
        color="success"
        icon={<div className="badge badge-success badge-sm">H</div>}
      />
      <Card
        title="Absen"
        value={summary.totalSakit + summary.totalIzin}
        desc="Izin/Sakit"
        color="warning"
        icon={<AlertCircle size={24} />}
      />
      <Card
        title="Alfa"
        value={summary.totalAlpha}
        desc="Tanpa Ket."
        color="error"
        icon={<div className="badge badge-error badge-sm">A</div>}
      />
      <Card
        title="Bolos"
        value={summary.totalBolos}
        desc="Bolos"
        textColor="text-purple-500"
        icon={<UserX size={24} className="text-purple-500" />}
      />
    </div>
  );
});

const ChartSection = React.memo(
  ({
    analytics,
    showRank,
  }: {
    analytics: AnalyticsData;
    userType: any;
    showRank: boolean;
  }) => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-700">
        {/* Area Chart */}
        <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-2 border border-base-200">
          <div className="card-body p-4">
            <h2 className="card-title text-sm opacity-70 mb-2">
              Tren Kehadiran
            </h2>
            <div className="h-62.5 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trend}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={COLORS.hadir}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.hadir}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    minTickGap={30}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.bg,
                      borderRadius: "8px",
                      border: "none",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hadir"
                    stroke={COLORS.hadir}
                    fillOpacity={1}
                    fill="url(#colorHadir)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card bg-base-100 shadow-xl border border-base-200">
          <div className="card-body p-4 relative">
            <h2 className="card-title text-sm opacity-70 mb-2">Komposisi</h2>
            <div className="h-62.5 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Hadir", value: analytics.summary.totalHadir },
                      { name: "Sakit", value: analytics.summary.totalSakit },
                      { name: "Izin", value: analytics.summary.totalIzin },
                      { name: "Alfa", value: analytics.summary.totalAlpha },
                      { name: "Bolos", value: analytics.summary.totalBolos },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill={COLORS.hadir} />
                    <Cell fill={COLORS.sakit} />
                    <Cell fill={COLORS.izin} />
                    <Cell fill={COLORS.alpha} />
                    <Cell fill={COLORS.bolos} />
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={10}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-4">
                <div className="text-center">
                  <span className="text-2xl font-bold">
                    {analytics.summary.attendanceRate}%
                  </span>
                  <p className="text-[10px] opacity-50 uppercase">Hadir</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Insight Cards */}
        <div className="card bg-base-100 shadow-sm border border-base-200 col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div className="flex items-center justify-between bg-success/10 p-4 rounded-xl border border-success/20">
            <div>
              <p className="text-xs opacity-60">Hari Paling Rajin</p>
              <p className="text-xl font-bold">
                {analytics.insights.mostProductiveDay.day}
              </p>
              <span className="badge badge-success badge-sm mt-1">
                {analytics.insights.mostProductiveDay.percentage}% Hadir
              </span>
            </div>
            <ThumbsUp className="text-success w-8 h-8 opacity-50" />
          </div>
          <div className="flex items-center justify-between bg-error/10 p-4 rounded-xl border border-error/20">
            <div>
              <p className="text-xs opacity-60">Hari Paling Sepi</p>
              <p className="text-xl font-bold">
                {analytics.insights.leastProductiveDay.day}
              </p>
              <span className="badge badge-error badge-sm mt-1">
                {analytics.insights.leastProductiveDay.percentage}% Hadir
              </span>
            </div>
            <ThumbsDown className="text-error w-8 h-8 opacity-50" />
          </div>
        </div>

        {/* Class Ranking (Only for Admin/Kesiswaan) */}
        {showRank && analytics.classPerformance.length > 0 && (
          <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-3 border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-sm opacity-70">
                Ranking Kelas (Top 5)
              </h2>
              <div className="h-50 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.classPerformance}
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.1}
                      horizontal={false}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{ backgroundColor: COLORS.bg }}
                    />
                    <Bar
                      dataKey="percentage"
                      fill={COLORS.hadir}
                      radius={[0, 4, 4, 0]}
                      barSize={15}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// --- MAIN COMPONENT ---
export default function RekapRoute() {
  const [ordering, setOrdering] = useState<"DESC" | "ASC">("DESC");
  const [showAdvanceQuery, setShowAdvanceQuery] = useState(false);
  const [kelasId, setKelasId] = useState<number>();

  // State Tanggal
  const [startDate, setStartDate] = useState<string>(
    "date('now', 'start of month')"
  );
  const [endDate, setEndDate] = useState<string>("date('now')");

  // State Picker UI
  const [startDatePicker, setStartDatePicker] = useState<Date>();
  const [endDatePicker, setEndDatePicker] = useState<Date>();

  const db = useDatabase();
  const [user] = useUser();
  const [kelass, setKelass] = useState<KelasProps[]>([]);

  // State Data & Concurrency
  const [isPending, startTransition] = useTransition(); // REACT 18 MAGIC
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const deferredAnalytics = useDeferredValue(analytics);

  // Load List Kelas
  useEffect(() => {
    if (!db) return;
    // setKelass(getKelas({ db }));
    getKelas({ db }).then((kelass) => setKelass(kelass));
  }, [db]);

  // Handle Fetch Analytics (dengan Debounce + Transition)
  useEffect(() => {
    if (!db) return;

    // Gunakan timeout untuk debounce (tunggu user selesai klik/ketik 500ms)
    const timeoutId = setTimeout(() => {
      startTransition(async () => {
        try {
          // Fetch data (Worker/SQL)
          const data = await getAnalyticsData(startDate, endDate, kelasId);
          setAnalytics(data);
        } catch (error) {
          console.error("Gagal memuat analitik:", error);
        }
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [db, startDate, endDate, kelasId]);

  // Sync DatePicker to SQL String
  useEffect(() => {
    if (startDatePicker && endDatePicker) {
      const s = formatDateForDB(startDatePicker);
      const e = formatDateForDB(endDatePicker);
      if (s !== startDate || e !== endDate) {
        setStartDate(s);
        setEndDate(e);
      }
    }
  }, [startDatePicker, endDatePicker]);

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setShowAdvanceQuery(value === "custom");

    if (value !== "custom") {
      let newStart = startDate;
      let newEnd = 'date("now")';

      if (value === "month") newStart = "date('now', 'start of month')";
      else if (value === "days15") newStart = "date('now', '-15 days')";
      else if (value === "week")
        newStart = "date('now', 'weekday 1', '-7 days')";
      else if (value === "all") newStart = '"2024-01-01"';

      // Update state langsung trigger useEffect fetch
      setStartDate(newStart);
      setEndDate(newEnd);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      {/* Loading Bar (Top) - Muncul saat calculating */}
      {isPending && (
        <div className="fixed top-0 left-0 w-full z-50 h-1 bg-transparent">
          <div className="h-full bg-primary animate-pulse w-full origin-left"></div>
        </div>
      )}

      <main className="grow p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* HEADER & FILTERS */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary" />
              Dashboard Absensi
            </h1>
            <p className="text-base-content/60 text-sm">
              Analitik performa{" "}
              {isPending ? (
                <span className="loading loading-dots loading-xs"></span>
              ) : (
                "siap"
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select
              onChange={handleDateChange}
              className="select select-bordered select-sm w-full md:w-auto"
            >
              <option value="month">Bulan Ini</option>
              <option value="week">Minggu Ini</option>
              <option value="days15">15 Hari Terakhir</option>
              <option value="all">Semua Data</option>
              <option value="custom">Pilih Tanggal Manual</option>
            </select>

            <select
              onChange={(e) =>
                setKelasId(
                  e.target.value === "all"
                    ? undefined
                    : parseInt(e.target.value)
                )
              }
              className="select select-bordered select-sm w-full md:w-auto"
            >
              <option value="all">Semua Kelas</option>
              {kelass.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CUSTOM DATE PICKER */}
        {showAdvanceQuery && (
          <div className="collapse collapse-arrow bg-base-100 border border-base-200 shadow-sm">
            <input type="checkbox" defaultChecked />
            <div className="collapse-title text-sm font-medium flex gap-2 items-center">
              <Calendar size={16} /> Mode Tanggal Manual
            </div>
            <div className="collapse-content">
              <div className="flex flex-col md:flex-row justify-center gap-4 pt-2">
                <div className="text-center">
                  <span className="label-text font-bold">Dari</span>
                  <DayPicker
                    mode="single"
                    selected={startDatePicker}
                    onSelect={setStartDatePicker}
                    className="border rounded-lg p-2 bg-base-100 text-sm shadow-sm"
                  />
                </div>
                <div className="text-center">
                  <span className="label-text font-bold">Sampai</span>
                  <DayPicker
                    mode="single"
                    selected={endDatePicker}
                    onSelect={setEndDatePicker}
                    className="border rounded-lg p-2 bg-base-100 text-sm shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CONTENT AREA (Menggunakan Deferred Value) --- */}
        {/* Jika analytics null (awal load), tampilkan skeleton sederhana */}
        {!analytics && !deferredAnalytics && (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-32 bg-base-300 rounded-box w-full"></div>
            <div className="h-64 bg-base-300 rounded-box w-full"></div>
          </div>
        )}

        {/* Render UI saat data ada (menggunakan deferredAnalytics agar transisi smooth) */}
        {deferredAnalytics && (
          <div
            className={`space-y-6 transition-all duration-300 ${
              isPending
                ? "opacity-50 grayscale-[0.5] scale-[0.99]"
                : "opacity-100 scale-100"
            }`}
          >
            {/* 1. Stats */}
            <StatCards analytics={deferredAnalytics} />

            {/* 2. Charts */}
            <ChartSection
              analytics={deferredAnalytics}
              userType={user?.type}
              showRank={!kelasId && user?.type === "kesiswaan"}
            />

            {/* 3. Table Data Mentah */}
            <div className="divider text-xs uppercase tracking-widest opacity-50">
              Data Detail
            </div>

            <div className="flex justify-between items-center px-1">
              <h3 className="font-bold text-lg">Rincian Data</h3>
              <select
                onChange={(e) => setOrdering(e.target.value as "DESC" | "ASC")}
                className="select select-bordered select-xs"
              >
                <option value="DESC">Paling rajin</option>
                <option value="ASC">Paling bermasalah</option>
              </select>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden min-h-100">
              <div className="overflow-x-auto p-1">
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
        )}
      </main>

      <Footer active="rekap" />
    </div>
  );
}
