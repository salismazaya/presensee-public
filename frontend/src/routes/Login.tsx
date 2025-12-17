import { useState } from "react";
import { login } from "../helpers/api";
import Swal from "sweetalert2";
import useToken from "../hooks/useToken";
import ThemeToggle from "../components/ThemeToggle";
import serviceWorkerUtils from "../helpers/serviceWorker";
import Cookies from "universal-cookie";

export default function Login() {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setToken] = useToken();
  const cookies = new Cookies();

  const handleLogin = async () => {
    if (username && password) {
      try {
        setIsLoading(true);
        const token = await login(username, password);
        setToken(token.token);

        cookies.set("user_type", token.type);
        await serviceWorkerUtils.unregister();
        // await serviceWorkerUtils.register();
        window.location.href = "/";

      } catch (e: any) {
        Swal.fire({
          title: "Gagal Masuk",
          text: "Username atau password salah.",
          icon: "error",
          confirmButtonText: "Coba Lagi",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      Swal.fire({
        icon: "warning",
        title: "Form Belum Lengkap",
        text: "Mohon isi username dan password terlebih dahulu.",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4 font-sans relative">
      {/* --- TOMBOL THEME TOGGLE (POSISI POJOK KANAN ATAS) --- */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>

      <div className="card w-full max-w-sm bg-base-100 shadow-2xl border border-base-200 z-10">
        <div className="card-body py-10 px-8">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 p-2">
              <img
                src="/logo.png"
                alt="Presensee Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="text-3xl font-bold text-primary absolute opacity-0">
                P
              </span>
            </div>
            <h2 className="text-2xl font-bold text-base-content">
              Selamat Datang
            </h2>
            <p className="text-sm text-base-content/60 mt-1">
              Silakan masuk ke akun Anda
            </p>
          </div>

          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Username</span>
              </label>
              <label className="input input-bordered flex items-center gap-2 focus-within:input-primary transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-4 h-4 opacity-70"
                >
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
                </svg>
                <input
                  type="text"
                  className="grow"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </label>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Password</span>
              </label>
              <label className="input input-bordered flex items-center gap-2 focus-within:input-primary transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-4 h-4 opacity-70"
                >
                  <path
                    fillRule="evenodd"
                    d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z"
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  type="password"
                  className="grow"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </label>
            </div>
          </div>

          <div className="form-control mt-6">
            <button
              className="btn btn-primary w-full text-lg font-semibold shadow-lg hover:scale-[1.02] transition-transform"
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>{" "}
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </div>
        </div>

        <div className="bg-base-200/50 p-4 text-center rounded-b-2xl border-t border-base-200">
          <p className="text-xs text-base-content/50">
            &copy; {new Date().getFullYear()} Presensee. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
