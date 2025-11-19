import { BrowserRouter, Routes, Route } from "react-router";
import Login from "./routes/Login";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout";

import Dashboard from "./routes/Dashboard";
import About from "./routes/About";
import Absensi from "./routes/Absensi";
import AbsensiDetail from "./routes/AbsensiDetail";
import { SharedDataContextConsumer } from "./contexts/SharedDataContext";
import AbsensiKelas from "./routes/AbsensiKelas";
import Rekap from "./routes/Rekap";
import ChangePassword from "./routes/ChangePassword";
import MintaRekap from "./routes/MintaRekap";
import MintaRekapDetail from "./routes/MintaRekapDetail";
import MintaAbsensiKelas from "./routes/MintaRekapKelas";
import { useEffect } from "react";
import { getVersion } from "./helpers/api";
import serviceWorkerUtils from "./helpers/serviceWorker";
import InstallPWA from "./components/InstallPWA";

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

        console.log(currentVersion, latestVersion)
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
              element={<AuthenticatedLayout child={<Dashboard />} />}
            />

            <Route
              path="/absensi-kelas"
              element={<AuthenticatedLayout child={<AbsensiKelas />} />}
            />

            <Route
              path="/rekap"
              element={<AuthenticatedLayout child={<Rekap />} />}
            />

            <Route
              path="/minta-rekap-kelas"
              element={<AuthenticatedLayout child={<MintaAbsensiKelas />} />}
            />

            <Route path="/minta-rekap">
              <Route
                index
                element={<AuthenticatedLayout child={<MintaRekap />} />}
              />
              <Route
                path=":bulan_tahun"
                element={<AuthenticatedLayout child={<MintaRekapDetail />} />}
              />
            </Route>

            <Route path="/absensi">
              <Route
                index
                element={<AuthenticatedLayout child={<Absensi />} />}
              />
              <Route
                path=":absen_id"
                element={<AuthenticatedLayout child={<AbsensiDetail />} />}
              />
            </Route>

            <Route
              path="/change-password"
              element={<AuthenticatedLayout child={<ChangePassword />} />}
            />
          </Routes>
        </BrowserRouter>

        <InstallPWA />
      </>
    </SharedDataContextConsumer>
  );
}

export default App;
