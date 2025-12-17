export interface AnalyticsData {
  summary: {
    totalHadir: number;
    totalSakit: number;
    totalIzin: number;
    totalAlpha: number;
    totalBolos: number;
    attendanceRate: number;
  };
  // Tambahkan Interface Insight
  insights: {
    mostProductiveDay: { day: string; percentage: number };
    leastProductiveDay: { day: string; percentage: number };
  };
  trend: {
    date: string;
    hadir: number;
    tidak_hadir: number;
  }[];
  classPerformance: {
    name: string;
    percentage: number;
  }[];
}

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const getAnalyticsData = (
  db: any,
  startDate?: string,
  endDate?: string,
  kelasId?: number
): AnalyticsData => {
  let dateFilter = "";
  let classFilter = "";
  const params: any[] = [];

  // 1. Setup Filter Query (Sama seperti sebelumnya)
  if (startDate && endDate) {
    dateFilter = `AND a.date BETWEEN ${startDate} AND ${endDate}`;
  }
  
  if (kelasId) {
    classFilter = `AND s.kelas_id = ?`;
    params.push(kelasId);
  }

  // 2. Query Summary (Sama seperti sebelumnya)
  const summaryQuery = `
    SELECT 
      SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) as h,
      SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) as s,
      SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) as i,
      SUM(CASE WHEN a.status = 'alfa' THEN 1 ELSE 0 END) as a,
      SUM(CASE WHEN a.status = 'bolos' THEN 1 ELSE 0 END) as b,
      COUNT(*) as total
    FROM absensi a
    JOIN siswa s ON a.siswa_id = s.id
    WHERE 1=1 ${dateFilter} ${classFilter}
  `;
  
  const summaryRes = db.exec(summaryQuery, params);
  const summaryRow = summaryRes.length ? summaryRes[0].values[0] : [0,0,0,0,0,0];
  const [h, s, i, a, b, total] = summaryRow as number[];

  // 3. Query Trend Harian (Sama seperti sebelumnya)
  const trendQuery = `
    SELECT 
      a.date,
      SUM(CASE WHEN a.status = 'H' THEN 1 ELSE 0 END) as hadir,
      SUM(CASE WHEN a.status != 'H' THEN 1 ELSE 0 END) as absen
    FROM absensi a
    JOIN siswa s ON a.siswa_id = s.id
    WHERE 1=1 ${dateFilter} ${classFilter}
    GROUP BY a.date
    ORDER BY a.date ASC
  `;
  const trendRes = db.exec(trendQuery, params);
  const trendData = trendRes.length 
    ? trendRes[0].values.map((row: any) => ({
        date: row[0],
        hadir: row[1],
        tidak_hadir: row[2]
      }))
    : [];


  const dayQuery = `
    SELECT 
      strftime('%w', a.date) as day_num,
      CAST(SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as percentage
    FROM absensi a
    JOIN siswa s ON a.siswa_id = s.id
    WHERE 1=1 ${dateFilter} ${classFilter}
    GROUP BY day_num
  `;

  const dayRes = db.exec(dayQuery, params);
  
  let mostProductive = { day: "-", percentage: 0 };
  let leastProductive = { day: "-", percentage: 100 }; 

  if (dayRes.length > 0) {
    const rows = dayRes[0].values;
    // Cari Max dan Min
    rows.forEach((row: any) => {
      const dayIdx = parseInt(row[0]); // 0-6
      const pct = parseFloat(row[1]);
      const dayName = DAYS_ID[dayIdx];

      if (pct > mostProductive.percentage) {
        mostProductive = { day: dayName, percentage: Math.round(pct) };
      }
      if (pct < leastProductive.percentage) {
        leastProductive = { day: dayName, percentage: Math.round(pct) };
      }
    });
    
    // Handle jika hanya ada 1 hari data, maka least = most (atau reset jika logic butuh beda)
    if (rows.length === 1) {
       leastProductive = { day: "-", percentage: 0 }; 
    }
  } else {
    leastProductive = { day: "-", percentage: 0 };
  }

  let classPerfData: any[] = [];
  if (!kelasId) {
    const classQuery = `
      SELECT 
        k.name,
        CAST(SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as percentage
      FROM absensi a
      JOIN siswa s ON a.siswa_id = s.id
      JOIN kelas k ON s.kelas_id = k.id
      WHERE 1=1 ${dateFilter}
      GROUP BY k.id
      ORDER BY percentage DESC
      LIMIT 5
    `;
    const classRes = db.exec(classQuery); 
    classPerfData = classRes.length
      ? classRes[0].values.map((row: any) => ({
          name: row[0],
          percentage: Math.round(row[1] as number),
        }))
      : [];
  }

  return {
    summary: {
      totalHadir: h || 0,
      totalSakit: s || 0,
      totalIzin: i || 0,
      totalAlpha: a || 0,
      totalBolos: b || 0,
      attendanceRate: total ? Math.round((h / total) * 100) : 0,
    },
    insights: {
      mostProductiveDay: mostProductive,
      leastProductiveDay: leastProductive
    },
    trend: trendData,
    classPerformance: classPerfData,
  };
};