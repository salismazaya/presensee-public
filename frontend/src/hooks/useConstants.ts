import { useContext } from "react";
import ConstantsContext from "../contexts/ConstantsContext";

export default function useConstants() {
  return useContext(ConstantsContext);
}
