import { BrowserRouter, Routes, Route } from "react-router";
import Login from "./routes/Login";
import AuthenticatedDatabaseLayout from "./layouts/AuthenticatedDatabaseLayout";

import Dashboard from "./routes/Dashboard";
import About from "./routes/About";
import Absensi from "./routes/Absensi";
import AbsensiDetail from "./routes/AbsensiDetail";
import AbsensiKelas from "./routes/AbsensiKelas";
import Rekap from "./routes/Rekap";
import ChangePassword from "./routes/ChangePassword";
import MintaRekap from "./routes/MintaRekap";
import MintaRekapDetail from "./routes/MintaRekapDetail";
import MintaAbsensiKelas from "./routes/MintaRekapKelas";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { SharedDataContextConsumer } from "./contexts/SharedDataContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";

import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "react-toastify";

function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log("SW Registered", r);
    },
    onRegisterError(error: any) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      const id = toast.info(
        <div className="flex flex-col gap-2 p-1">
          <span className="font-bold text-sm">Versi baru tersedia!</span>
          <p className="text-xs opacity-80">
            Aplikasi perlu diperbarui untuk fitur terbaru.
          </p>
          <button
            onClick={() => {
              updateServiceWorker(true);
              setNeedRefresh(false);
              toast.dismiss(id);
            }}
            className="btn btn-primary btn-sm mt-1"
          >
            Update Sekarang
          </button>
        </div>,
        {
          position: "bottom-center",
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          closeButton: false,
        },
      );
    }
  }, [needRefresh]);

  return (
    <SharedDataContextConsumer>
      <ConfirmProvider>
        <>
          <BrowserRouter>
            <Routes>
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={<AuthenticatedDatabaseLayout child={<Dashboard />} />}
              />

              <Route
                path="/absensi-kelas"
                element={<AuthenticatedDatabaseLayout child={<AbsensiKelas />} />}
              />

              <Route
                path="/rekap"
                element={<AuthenticatedDatabaseLayout child={<Rekap />} />}
              />

              <Route
                path="/minta-rekap-kelas"
                element={
                  <AuthenticatedDatabaseLayout child={<MintaAbsensiKelas />} />
                }
              />

              <Route path="/minta-rekap">
                <Route
                  index
                  element={<AuthenticatedDatabaseLayout child={<MintaRekap />} />}
                />
                <Route
                  path=":bulan_tahun"
                  element={
                    <AuthenticatedDatabaseLayout child={<MintaRekapDetail />} />
                  }
                />
              </Route>

              <Route path="/absensi">
                <Route
                  index
                  element={<AuthenticatedDatabaseLayout child={<Absensi />} />}
                />
                <Route
                  path=":absen_id"
                  element={
                    <AuthenticatedDatabaseLayout child={<AbsensiDetail />} />
                  }
                />
              </Route>

              <Route
                path="/change-password"
                element={
                  <AuthenticatedDatabaseLayout child={<ChangePassword />} />
                }
              />
            </Routes>
          </BrowserRouter>

          {/* <InstallPWA /> */}
          <ToastContainer />
        </>
      </ConfirmProvider>
    </SharedDataContextConsumer>
  );
}

export default App;
