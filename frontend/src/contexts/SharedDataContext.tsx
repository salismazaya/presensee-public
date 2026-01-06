import { createContext, useEffect, useState, type JSX } from "react";
import { getMe } from "../helpers/api";
import useToken from "../hooks/useToken";
import type { ConflictData } from "../components/ConflictsList";
import { OnlineContextConsumer } from "./OnlineContext";
import useOnline from "../hooks/useOnline";

export interface User {
  username: string;
  type: "kesiswaan" | "sekretaris" | "wali_kelas";
}

interface SharedDataProps {
  kelas?: number;
  setKelas?: (kelas: number) => void;
  user?: User;
  isLogout?: boolean;
  isGlobalLoading?: boolean;
  setGlobalLoading?: (l: boolean) => void;
  lastRefresh?: number;
  setLastRefresh?: (l: number) => void;
  conflicts?: ConflictData[];
  setConflicts?: (l: ConflictData[]) => void;
  setSiswasKelasName?: (d: { id: number; kelasName: string }[]) => void;
  siswasKelasName: Record<number, string>;
}

export function SharedDataContextConsumer({
  children,
}: {
  children: JSX.Element;
}) {
  return (
    <OnlineContextConsumer>
      <_SharedDataContextConsumer>{children}</_SharedDataContextConsumer>
    </OnlineContextConsumer>
  );
}

export function _SharedDataContextConsumer({
  children,
}: {
  children: JSX.Element;
}) {
  const currentKelasString = localStorage.getItem("ACTIVE_KELAS");
  let currentKelas = undefined;

  if (currentKelasString) {
    currentKelas = parseInt(currentKelasString);
  }

  const _setKelas = async (kelas: number) => {
    localStorage.setItem("ACTIVE_KELAS", kelas.toString());
    setKelas(kelas);
  };

  const [kelas, setKelas] = useState<number | undefined>(currentKelas);
  const [token] = useToken();
  const [user, setUser] = useState<User>();
  const [isLogout, setIsLogout] = useState<boolean>(false);
  const [isGlobalLoading, setGlobalLoading] = useState<boolean>(false);

  const [conflicts, setConflicts] = useState<ConflictData[]>([]);

  const isOnline = useOnline();

  const currentLastRefreshString = localStorage.getItem("LAST_REFRESH");

  let currentLastRefresh: number | undefined = undefined;
  if (currentLastRefreshString) {
    currentLastRefresh = parseInt(currentLastRefreshString);
  }

  const [lastRefresh, setLastRefresh] = useState<number | undefined>(
    currentLastRefresh
  );

  const [siswasKelasName, _setSiswasKelasName] = useState<
    Record<number, string>
  >({});

  function setSiswasKelasName(data: { id: number; kelasName: string }[]) {
    const tempSiswasKelasName: any = {};
    data.forEach((x) => {
      tempSiswasKelasName[x.id] = x.kelasName;
    });

    _setSiswasKelasName({
      ...siswasKelasName,
      ...tempSiswasKelasName,
    });
  }

  const _setLastRefresh = (lastRefresh: number) => {
    localStorage.setItem("LAST_REFRESH", lastRefresh.toString());
    setLastRefresh(lastRefresh);
  };
 
  useEffect(() => {
    if (!token) {
      setIsLogout(true);
    }

    if (token) {
      const currentUser = localStorage.getItem("USER");

      if (!currentUser || isOnline === true) {
        getMe(token)
          .then((user) => {
            setUser(user);
            if (user.kelas) {
              setKelas(user.kelas);
            }

            localStorage.setItem("USER", JSON.stringify(user));
          })
          .catch(() => {
            setIsLogout(true);
          });
      } else {
        const user = JSON.parse(currentUser);
        if (user.kelas && user.type !== "kesiswaan") {
          setKelas(user.kelas);
        }
        setUser(user);
      }
    }
  }, [token, isOnline]);

  const data: SharedDataProps = {
    kelas,
    setKelas: _setKelas,
    user,
    isLogout,
    isGlobalLoading,
    setGlobalLoading,
    lastRefresh: lastRefresh,
    setLastRefresh: _setLastRefresh,
    conflicts,
    setConflicts,
    siswasKelasName,
    setSiswasKelasName,
  };

  return (
    <SharedDataContext value={data}>
      <>
        {isGlobalLoading && (
          <div className="w-full fixed bg-base-100/80 z-50 h-screen flex items-center">
            <span className="loading loading-spinner w-36 lg:w-56 mx-auto"></span>
          </div>
        )}
        {children}
      </>
    </SharedDataContext>
  );
}

const SharedDataContext = createContext<SharedDataProps>({
  siswasKelasName: {},
});

export default SharedDataContext;
