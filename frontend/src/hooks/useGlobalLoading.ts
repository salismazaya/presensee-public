import { useContext } from "react";
import SharedDataContext from "../contexts/SharedDataContext";

export default function useGlobalLoading(): [boolean, (l: boolean) => void] {
  const { isGlobalLoading, setGlobalLoading } = useContext(SharedDataContext);

  return [isGlobalLoading ?? false, setGlobalLoading ?? function () {}];
}
