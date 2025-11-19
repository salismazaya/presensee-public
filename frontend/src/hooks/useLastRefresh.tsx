import { useContext, useEffect, useRef, useState } from "react";
import SharedDataContext from "../contexts/SharedDataContext";

function waktuLaluUnix(unixTime: number) {
  // kalau unixTime masih dalam detik, kalikan 1000
  if (unixTime.toString().length === 10) {
    unixTime *= 1000;
  }

  const date = new Date(unixTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) {
    return "baru saja";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} menit yang lalu`;
  } else if (diffHours < 24) {
    return `${diffHours} jam yang lalu`;
  } else if (diffDays < 30) {
    return `${diffDays} hari yang lalu`;
  } else {
    return `${diffMonths} bulan yang lalu`;
  }
}

export default function useLastRefresh(): [
  string | undefined,
  (l: number) => void
] {
  const { lastRefresh, setLastRefresh } = useContext(SharedDataContext);
  const [lastRefreshString, setLastRefreshString] = useState<string>();
  const lastRefreshRef = useRef(lastRefresh);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastRefreshRef.current) return;
      const time = waktuLaluUnix(lastRefreshRef.current);
      setLastRefreshString(time);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    lastRefreshRef.current = lastRefresh;
  }, [lastRefresh]);

  return [lastRefreshString, setLastRefresh ?? function () {}];
}
