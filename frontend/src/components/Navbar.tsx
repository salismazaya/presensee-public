import { Link } from "react-router";
import ThemeToggle from "./ThemeToggle";
import { OnlineContextConsumer } from "../contexts/OnlineContext";
import { useEffect, useState } from "react";
import useOnline from "../hooks/useOnline";

export default function Navbar() {
  return (
    <OnlineContextConsumer>
      <_Navbar />
    </OnlineContextConsumer>
  );
}

function _Navbar() {
  const [status, setStatus] = useState<"online" | "offline" | "checking">(
    "checking"
  );

  const isOnline = useOnline();

  useEffect(() => {
    if (isOnline === true) {
      setStatus("online");
    } else if (isOnline == false) {
      setStatus("offline");
    }
  }, [isOnline]);

  const statusColor: Record<string, string> = {
    online: "bg-success", // Hijau
    offline: "bg-error", // Merah
    checking: "bg-info", // Biru
  };

  useEffect(() => {}, []);

  return (
    <div className="sticky top-0 z-50 w-full bg-base-100/90 backdrop-blur-lg border-b border-base-200 transition-all duration-300">
      <div className="navbar max-w-5xl mx-auto px-4 md:px-0">
        <div className="flex-1 flex items-center gap-3">
          <Link
            to="/"
            className="btn btn-ghost hover:bg-transparent px-0 text-2xl font-bold text-primary tracking-tight"
          >
            <span className="text-base-content">Presen</span>see
            <span className="text-primary text-4xl leading-3">.</span>
          </Link>

          {/* Indikator Status */}
          <div className="flex items-center gap-2 ml-2 bg-base-200/50 px-3 py-1 rounded-full border border-base-300">
            <span className="relative flex h-3 w-3">
              {status !== "offline" && (
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${statusColor[status]}`}
                ></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${statusColor[status]}`}
              ></span>
            </span>
          </div>
        </div>

        <div className="flex-none">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
