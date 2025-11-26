import { useState } from "react";

export default function useToken(): [
  string | null,
  (arg0: string) => void,
] {
  const [token, setToken] = useState<string | null>(localStorage.getItem("TOKEN"));

  const _setToken = (token: string) => {
    localStorage.setItem("TOKEN", token);
    setToken(token);
  };

  return [token, _setToken];
}
