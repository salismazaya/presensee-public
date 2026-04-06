import { Link, useNavigate } from "react-router";
import ThemeToggle from "./ThemeToggle";
import { useEffect, useState } from "react";
import useOnline from "../hooks/useOnline";
import useUser from "../hooks/useUser";
import { toast } from "react-toastify";
import { useConfirm } from "../contexts/ConfirmContext";

export default function Navbar() {
  const [statusColor, setStatusColor] = useState<
    "text-primary" | "text-success" | "text-error"
  >("text-primary");

  const isOnline = useOnline();
  const [user] = useUser();
  const navigate = useNavigate();
  const askConfirm = useConfirm();

  useEffect(() => {
    setTimeout(() => {
      if (isOnline === true) {
        setStatusColor("text-success");
      } else if (isOnline == false) {
        setStatusColor("text-error");
      }
    }, 500);
  }, [isOnline]);

  const handleLogout = async () => {
    const isConfirmed = await askConfirm({
      title: "Konfirmasi Logout",
      message: "Apakah Anda yakin ingin keluar dari akun?",
      danger: true,
      confirmText: "Ya, Logout",
    });

    if (isConfirmed) {
      localStorage.removeItem("PRESENSEE_TOKEN");
      localStorage.removeItem("USER");
      toast.success("Berhasil keluar");
      navigate("/login");
    }
  };

  const formatUserType = (type?: string) => {
    switch (type) {
      case "kesiswaan":
        return "Kesiswaan";
      case "sekretaris":
        return "Sekretaris";
      case "wali_kelas":
        return "Wali Kelas";
      default:
        return type;
    }
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-base-100/90 backdrop-blur-lg border-b border-base-200 transition-all duration-300">
      <div className="navbar max-w-5xl mx-auto px-4 md:px-0">
        <div className="flex-1 flex items-center gap-3">
          <Link
            to="/"
            className={
              "btn btn-ghost hover:bg-transparent px-0 text-2xl font-bold tracking-tight " +
              statusColor
            }
          >
            <span className="text-base-content">Presen</span>see
            <span className="text-4xl leading-3">.</span>
          </Link>
        </div>

        <div className="flex-none flex items-center gap-2">
          {user && (
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm normal-case flex flex-col items-end gap-1 h-auto py-1.5"
              >
                <span className="text-sm font-bold leading-none">
                  {user.username}
                </span>
                <span className="text-[10px] opacity-60 leading-none">
                  {formatUserType(user.type)}
                </span>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-51 p-2 shadow-xl border border-base-200 mt-2"
              >
                <li>
                  <Link to="/change-password">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                    Ganti Password
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} className="text-error font-bold">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                      />
                    </svg>
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
