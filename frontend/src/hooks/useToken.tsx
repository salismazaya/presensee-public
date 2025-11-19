import { useEffect, useRef, useState } from "react";

export default function useToken(): [
  string | null,
  (arg0: string) => void,
  boolean
] {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const loadedRef = useRef(false);

  const _setToken = (token: string) => {
    localStorage.setItem("TOKEN", token);
    setToken(token);
  };

  useEffect(() => {
    const token = localStorage.getItem("TOKEN");
    setToken(token);
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    setLoaded(loadedRef.current);
  }, [loadedRef.current]);

  return [token, _setToken, loaded];
}
