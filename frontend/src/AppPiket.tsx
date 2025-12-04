// import { BrowserRouter } from "react-router";
// import { ToastContainer } from "react-toastify";
import { SharedDataContextConsumer } from "./contexts/SharedDataContext";
import { useEffect } from "react";
import { getVersion } from "./helpers/api";
import serviceWorkerUtils from "./helpers/serviceWorker";
import { BrowserRouter, Route, Routes } from "react-router";
import { ToastContainer } from "react-toastify";
import Scan from "./routes/piket/Scan";
import About from "./routes/piket/About";
import Login from "./routes/Login";

function AppPiket() {
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

  const piketPath = import.meta.env.VITE_PIKET_PATH || '';

  return (
    <SharedDataContextConsumer>
      <>
        <BrowserRouter>
          <Routes>
            <Route path={piketPath}>
              <Route index element={<Scan />} />
              <Route path="login" element={<Login />}  />
              <Route path="about" element={<About />}  />
            </Route>
          </Routes>
        </BrowserRouter>

        <ToastContainer />
      </>
    </SharedDataContextConsumer>
  );
}

export default AppPiket;
