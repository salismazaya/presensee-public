import { useContext } from "react";
import DatabaseContext from "../contexts/DatabaseContext";

export default function useDatabase() {
  const [db] = useContext(DatabaseContext);
  return db;
}
