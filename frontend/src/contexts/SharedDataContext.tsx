import { createContext, useEffect, useState, type JSX } from "react";
import { getMe } from "../helpers/api";
import useToken from "../hooks/useToken";

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
}

export function SharedDataContextConsumer({
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

  const currentLastRefreshString = localStorage.getItem("LAST_REFRESH");

  let currentLastRefresh: number | undefined = undefined;
  if (currentLastRefreshString) {
    currentLastRefresh = parseInt(currentLastRefreshString);
  }

  const [lastRefresh, setLastRefresh] = useState<number | undefined>(
    currentLastRefresh
  );

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
      if (!currentUser) {
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
  }, [token]);

  const data: SharedDataProps = {
    kelas,
    setKelas: _setKelas,
    user,
    isLogout,
    isGlobalLoading,
    setGlobalLoading,
    lastRefresh: lastRefresh,
    setLastRefresh: _setLastRefresh,
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

const SharedDataContext = createContext<SharedDataProps>({});

export default SharedDataContext;
