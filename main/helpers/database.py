import sqlite3


def dump_to_sqlite(kelas_qs, siswa_qs, absensi_qs, lock_absensi_qs):
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE kelas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );
    """)

    # Tabel Siswa
    cursor.execute("""
    CREATE TABLE siswa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        kelas_id INTEGER NOT NULL,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE RESTRICT
    );
    """)

    cursor.execute("""
    CREATE TABLE absensi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        siswa_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        previous_status TEXT,
        updated_at INTEGER,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE RESTRICT,
        UNIQUE(date, siswa_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE kunci_absensi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        kelas_id INTEGER NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE kelas_sekretaris (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kelas_id INTEGER NOT NULL,
        siswa_id INTEGER NOT NULL,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        UNIQUE(kelas_id, siswa_id)
    );
    """)

    for k in kelas_qs:
        cursor.execute(
            "INSERT INTO kelas (id, name) VALUES (?, ?)",
            (k.id, k.name)
        )

    # Siswa
    for s in siswa_qs:
        cursor.execute(
            "INSERT INTO siswa (id, fullname, kelas_id) VALUES (?, ?, ?)",
            (s.id, s.fullname, s.kelas_id)
        )

    # Absensi
    for a in absensi_qs:
        cursor.execute(
            "INSERT INTO absensi (id, date, siswa_id, status, updated_at) VALUES (?, ?, ?, ?, ?)",
            (a.id, str(a.date), a.siswa_id, a.status, int(a.updated_at.timestamp()))
        )
    
    # Lock Absen
    for l in lock_absensi_qs:  # noqa: E741
        cursor.execute(
            "INSERT INTO kunci_absensi (id, date, kelas_id) VALUES (?, ?, ?)",
            (l.id, l.date, l.kelas_id)
        )

    conn.commit()
    return conn