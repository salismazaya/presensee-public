import { useContext } from "react";
import DatabaseContext from "../contexts/DatabaseContext";

export default function useRefreshDatabase() {
  const [, refreshDb, setRefreshDb] = useContext(DatabaseContext);

  return () => {
    setRefreshDb((refreshDb as number) + 1);
  };
}
