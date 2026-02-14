import {
  createContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { refreshDatabase } from "../helpers/api";
import useToken from "../hooks/useToken";
import Swal from "sweetalert2";
import useGlobalLoading from "../hooks/useGlobalLoading";
import { getLocalDatabase } from "../helpers/database";
import initSqlJs, { type Database } from "sql.js";

export function DatabaseContextConsumer({ children }: { children: any }) {
  const [db, setDb] = useState<Database>();
  const [token] = useToken();
  const [refreshDb, setRefreshDb] = useState(0);
  const [, setIsLoading] = useGlobalLoading();

  const config = {
    locateFile: (filename: string) => `/${filename}`,
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (loaded.current) return;

    loaded.current = true;

    initSqlJs(config).then(async () => {
      setIsLoading(true);
      const { exists, db } = await getLocalDatabase();
      try {
        if (!exists) {
          const sql = await refreshDatabase(token);
          db.run(sql);
        }

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

type DatabaseContextProps = [
  Database | undefined,
  number | null,
  Dispatch<SetStateAction<number>> | null,
];

const DatabaseContext = createContext<DatabaseContextProps>([
  undefined,
  null,
  null,
]);

export default DatabaseContext;
