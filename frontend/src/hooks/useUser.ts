import { useContext } from "react";
import SharedDataContext, { type User } from "../contexts/SharedDataContext";

export default function useUser(): [User | undefined, boolean] {
  const { user, isLogout } = useContext(SharedDataContext);

  return [user, isLogout || false];
}
