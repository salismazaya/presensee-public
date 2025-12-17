import { createContext, useEffect, useRef, useState } from "react";
import { refreshDatabase } from "../helpers/api";
import useToken from "../hooks/useToken";
import Swal from "sweetalert2";
import useGlobalLoading from "../hooks/useGlobalLoading";
import useLastRefresh from "../hooks/useLastRefresh";
import { getLocalDatabase, insertToLocalDatabase } from "../helpers/database";
import LZString from "lz-string";

export function DatabaseContextConsumer({ children }) {
  const [db, setDb] = useState();
  const [token] = useToken();
  const [refreshDb, setRefreshDb] = useState(0);
  const [, setIsLoading] = useGlobalLoading();
  const [, setLastRefresh] = useLastRefresh();

  const config = {
    locateFile: (filename) => `/${filename}`,
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (loaded.current) return;

    loaded.current = true;

    initSqlJs(config).then(async (SQL) => {
      setIsLoading(true);

      const { exists, db } = await getLocalDatabase();
      try {
        if (!exists) {
          const sql = await refreshDatabase(token);
          db.run(sql);
        }

        setLastRefresh(new Date().getTime());
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      } catch {
        Swal.fire({
          icon: "error",
          text: "Gagal mendapatkan database, coba periksa koneksi internet atau mungkin PC server sedang mati",
        });
        setIsLoading(false);
      } finally {
        setDb(db);
      }
    });
  }, [token, refreshDb]);

  return (
    <DatabaseContext value={[db, refreshDb, setRefreshDb]}>
      {children}
    </DatabaseContext>
  );
}

const DatabaseContext = createContext();

export default DatabaseContext;
