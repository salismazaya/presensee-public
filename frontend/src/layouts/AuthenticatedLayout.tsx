import { useEffect, type JSX } from "react";
import useUser from "../hooks/useUser";
import { useNavigate } from "react-router";
import Swal from "sweetalert2";
import { DatabaseContextConsumer } from "../contexts/DatabaseContext";

export default function AuthenticatedLayout({ child }: { child: JSX.Element }) {
  const [, isLogout] = useUser();

  const navigate = useNavigate();

  useEffect(() => {
    if (isLogout) {
      Swal.fire({
        title: "Mohon masuk terlebih dahulu",
        icon: "info",
      });
      navigate("/login");
    }
  }, [isLogout]);

  return <DatabaseContextConsumer>{child}</DatabaseContextConsumer>;
}
