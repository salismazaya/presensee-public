import { useContext } from "react";
import OnlineContext from "../contexts/OnlineContext";

export default function useOnline(): boolean | undefined {
  const { isOnline } = useContext(OnlineContext);

  return isOnline;
}
