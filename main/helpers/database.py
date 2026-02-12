import sqlite3
import re


def minimize_sql_dump(raw_sql):
    # 1. Pisahkan perintah non-insert (CREATE, BEGIN, dll) dan perintah INSERT
    lines = raw_sql.split(";;")

    non_insert_statements = []
    insert_data = {}  # Format: {'nama_tabel': [value1, value2, ...]}

    # Regex untuk menangkap nama tabel dan isi VALUES
    # Pola: INSERT INTO "nama_tabel" VALUES(isi_data)
    insert_pattern = re.compile(r'INSERT INTO "(.+?)" VALUES\((.+?)\)', re.IGNORECASE)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = insert_pattern.search(line)
        if match:
            table_name = match.group(1)
            values = f"({match.group(2)})"

            if table_name not in insert_data:
                insert_data[table_name] = []
            insert_data[table_name].append(values)
        else:
            # Simpan perintah selain INSERT (seperti CREATE TABLE)
            non_insert_statements.append(line)

    # 2. Rekonstruksi SQL menjadi Batch Insert
    minimized_sql = []

    # Tambahkan perintah awal (BEGIN, CREATE TABLE, dll)
    for stmt in non_insert_statements:
        if "COMMIT" not in stmt:  # Kita handle COMMIT di paling akhir
            minimized_sql.append(f"{stmt};")

    # Tambahkan hasil batch insert
    for table, values_list in insert_data.items():
        batch_query = f'INSERT INTO "{table}" VALUES {", ".join(values_list)};'
        minimized_sql.append(batch_query)

    # Tutup dengan COMMIT
    minimized_sql.append("COMMIT;")

    return "\n".join(minimized_sql)


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
        cursor.execute("INSERT INTO kelas (id, name) VALUES (?, ?)", (k.id, k.name))

    # Siswa
    for s in siswa_qs:
        cursor.execute(
            "INSERT INTO siswa (id, fullname, kelas_id) VALUES (?, ?, ?)",
            (s.id, s.fullname, s.kelas_id),
        )

    # Absensi
    absensies_values = []

    for a in absensi_qs:
        data = (a.id, str(a.date), a.siswa_id, a.status, int(a.updated_at.timestamp()))
        absensies_values.append(data)

    cursor.executemany(
        "INSERT INTO absensi (id, date, siswa_id, status, updated_at) VALUES (?, ?, ?, ?, ?)",
        absensies_values,
    )

    # Lock Absen
    for l in lock_absensi_qs:  # noqa: E741
        cursor.execute(
            "INSERT INTO kunci_absensi (id, date, kelas_id) VALUES (?, ?, ?)",
            (l.id, l.date, l.kelas_id),
        )

    conn.commit()
    return conn
