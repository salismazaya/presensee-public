import Swal from "sweetalert2";
import { Link } from "react-router";
import Navbar from "../../components/Navbar";
import PiketFooter from "../../components/PiketFooter";

export default function About() {
  const version = localStorage.getItem("VERSION") || "";
  const piketRootPath = import.meta.env.VITE_PIKET_PATH;

  const handleLogout = () => {
    Swal.fire({
      title: "Logout?",
      text: "Apakah Anda yakin ingin keluar dari akun?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Keluar",
      confirmButtonColor: "#d33",
      cancelButtonText: "Batal",
    }).then((a) => {
      if (a.isConfirmed) {
        // Hapus data sesi
        localStorage.removeItem("USER");
        localStorage.removeItem("TOKEN");

        // Redirect
        window.location.href = "/login";
      }
    });
  };

  return (
    <div className="min-h-screen bg-base-200 font-sans pb-24">
      <Navbar />

      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {/* HEADER / INFO APLIKASI */}
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body items-center text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-2 text-primary">
              {/* Placeholder Icon Logo */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-10"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-primary tracking-tight">
              Presensee
            </h1>
            <p className="text-sm font-medium opacity-50 uppercase tracking-widest mb-4">
              Ver {version}
            </p>

            <p className="text-base-content/80 leading-relaxed">
              Aplikasi ini dioptimalkan untuk penggunaan mudah dengan
              ketergantungan internet yang minimal (PWA).
            </p>
          </div>
        </div>

        {/* TIM PENGEMBANG */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-0">
            <div className="p-4 border-b border-base-200 bg-base-200/50">
              <h2 className="font-bold text-sm text-base-content/60 uppercase">
                Pengembang
              </h2>
            </div>

            <div className="divide-y divide-base-200">
              {/* Developer 1 */}
              <a
                href="https://mazaya.is-a.dev"
                target="_blank"
                className="flex items-center gap-4 p-4 hover:bg-base-200 transition-colors group"
              >
                <div className="avatar placeholder size-10">
                  <img src="/salis.webp" alt="" />
                </div>
                <div className="grow">
                  <h3 className="font-bold group-hover:text-primary transition-colors">
                    Salis Mazaya
                  </h3>
                  <p className="text-xs text-base-content/60">
                    Fullstack Developer
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 text-base-content/30"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* MENU AKSI / PENGATURAN */}
        <div className="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
          <div className="flex flex-col">
            {/* Ganti Password */}
            <Link
              // to="/change-password"
              to={piketRootPath + "change-password"}
              className="flex items-center gap-3 p-4 hover:bg-base-200 transition-colors border-b border-base-200"
            >
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
              <div className="grow font-medium">Ganti Password</div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 opacity-30"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-left text-error group"
            >
              <div className="p-2 bg-red-100 text-red-600 rounded-lg group-hover:bg-red-200 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                  />
                </svg>
              </div>
              <div className="grow font-bold">Logout</div>
            </button>
          </div>
        </div>

        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-base-content/30">
            Built with React & DaisyUI
          </p>
        </div>
      </main>

      <PiketFooter active="about" />
    </div>
  );
}
