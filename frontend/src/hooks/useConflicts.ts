import { useContext } from "react";
import SharedDataContext from "../contexts/SharedDataContext";
import type { ConflictData } from "../components/ConflictsList";

export default function useConflicts(): [
  ConflictData[],
  ((l: ConflictData[]) => void) | null
] {
  const { conflicts, setConflicts } = useContext(SharedDataContext);

  return [conflicts || [], setConflicts || null];
}
