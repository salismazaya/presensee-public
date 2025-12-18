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
import { getVersion } from "./helpers/api";
import serviceWorkerUtils from "./helpers/serviceWorker";
import { ToastContainer } from "react-toastify";
import { SharedDataContextConsumer } from "./contexts/SharedDataContext";

function App() {
  useEffect(() => {
    // auto-update jika ada versi baru
    getVersion()
      .then((latestVersion) => {
        const currentVersion = localStorage.getItem("VERSION");
        if (!currentVersion) {
          localStorage.setItem("VERSION", latestVersion);
          return;
        }

        if (currentVersion != latestVersion) {
          localStorage.setItem("VERSION", latestVersion);
          serviceWorkerUtils.unregister();
        }
      })
      .catch((e) => {
        console.info("Failed get version", e);
      });
  }, []);

  return (
    <SharedDataContextConsumer>
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
    </SharedDataContextConsumer>
  );
}

export default App;
