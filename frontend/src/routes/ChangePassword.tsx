import Swal from "sweetalert2";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useState } from "react";
import { changePassword } from "../helpers/api";
import useToken from "../hooks/useToken";
import useGlobalLoading from "../hooks/useGlobalLoading";

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState<string>();
  const [newPassword, setNewPassword] = useState<string>();
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>();
  const [token] = useToken();
  const [, setLoading] = useGlobalLoading();

  const handleClick = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      Swal.fire({
        icon: "error",
        text: "Tolong isi semua field",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Swal.fire({
        icon: "error",
        text: "Password baru dan konfirmasi password tidak sama",
      });
      return;
    }

    if (!token) return;

    try {
      setLoading(true);

      const success = await changePassword(token, oldPassword, newPassword);
      if (success) {
        Swal.fire({
          titleText: "Sukses",
          text: "Password telah diganti",
          icon: "success",
        });
        // Opsional: Reset form setelah sukses
        setOldPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch (e: any) {
      Swal.fire({
        titleText: "Gagal",
        text: e.toString(),
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <Navbar />

      <div className="grow flex items-center justify-center p-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl font-bold text-center justify-center mb-6">
              Ganti Kata Sandi
            </h2>

            <div className="flex flex-col gap-4">
              {/* Field Kata Sandi Lama */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold">Kata sandi lama</span>
                </label>
                <input
                  type="password"
                  value={oldPassword || ""}
                  className="input input-bordered w-full focus:input-primary"
                  placeholder="••••••••"
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>

              {/* Field Kata Sandi Baru */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold">Kata sandi baru</span>
                </label>
                <input
                  type="password"
                  value={newPassword || ""}
                  className="input input-bordered w-full focus:input-primary"
                  placeholder="••••••••"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              {/* Field Konfirmasi Kata Sandi */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold">
                    Masukan ulang kata sandi
                  </span>
                </label>
                <input
                  type="password"
                  value={confirmNewPassword || ""}
                  className="input input-bordered w-full focus:input-primary"
                  placeholder="••••••••"
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>

              <div className="card-actions justify-end mt-6">
                <button
                  className="btn btn-primary w-full text-lg"
                  onClick={handleClick}
                >
                  Ganti Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}