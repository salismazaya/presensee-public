import { useEffect, type JSX } from "react";
import useUser from "../hooks/useUser";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

export default function AuthenticatedLayout({ child }: { child: JSX.Element }) {
  const [, isLogout] = useUser();

  const navigate = useNavigate();

  useEffect(() => {
    if (isLogout) {
      toast.info("Mohon masuk terlebih dahulu");
      navigate("/login");
    }
  }, [isLogout]);

  return child;
}
