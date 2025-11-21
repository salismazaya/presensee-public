import { createContext, useEffect, useState } from "react";
import { refreshDatabase } from "../helpers/api";
import useToken from "../hooks/useToken";
import Swal from "sweetalert2";
import useGlobalLoading from "../hooks/useGlobalLoading";
import useLastRefresh from "../hooks/useLastRefresh";
import { insertToLocalDatabase } from "../helpers/database";
import LZString from "lz-string";

export function DatabaseContextConsumer({ children }) {
  const [db, setDb] = useState();
  const [token,] = useToken();
  const [refreshDb, setRefreshDb] = useState(0);
  const [, setIsLoading] = useGlobalLoading();
  const [, setLastRefresh] = useLastRefresh();

  const config = {
    locateFile: (filename) => `/${filename}`,
  }

  
  useEffect(() => {
    if (!token) return;

    initSqlJs(config).then(function (SQL) {
      setIsLoading(true);
      const currentDatabase = localStorage.getItem("DATABASE");

      if (!currentDatabase) {
        const db = new SQL.Database();
        refreshDatabase(token)
          .then((sql) => {
            db.run(sql);
            insertToLocalDatabase(sql);
            setDb(db);
            
            setLastRefresh(new Date().getTime());
            setTimeout(() => {
              setIsLoading(false);
            }, 500);
          })
          .catch(() => {
            Swal.fire({
              icon: "error",
              text: "Gagal mendapatkan database, coba periksa koneksi internet atau mungkin PC server sedang mati",
            });
            setIsLoading(false);
          });
      } else {
        const db = new SQL.Database();
        db.run(LZString.decompress(currentDatabase));
        
        setDb(db);
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
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
