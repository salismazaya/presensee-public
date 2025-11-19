import { useContext } from "react";
import SharedDataContext from "../contexts/SharedDataContext";

export default function useKelas(): [
  number | undefined,
  (arg0: number) => void
] {
  const { kelas, setKelas } = useContext(SharedDataContext);
  return [kelas, setKelas || function () {}];
}
