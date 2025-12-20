import { useContext } from "react";
import SharedDataContext from "../contexts/SharedDataContext";

type SiswaKelasProps = [
  Record<number, string>,
  (arg0: { id: number; kelasName: string }[]) => void
];

export default function useSiswasKelasName(): SiswaKelasProps {
  const { siswasKelasName, setSiswasKelasName } = useContext(SharedDataContext);

  return [siswasKelasName, setSiswasKelasName || function () {}];
}
