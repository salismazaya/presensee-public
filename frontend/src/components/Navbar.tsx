import { Link } from "react-router";
import ThemeToggle from "./ThemeToggle";
import { useEffect, useState } from "react";
import useOnline from "../hooks/useOnline";

export default function Navbar() {
  const [statusColor, setStatusColor] = useState<
    "text-primary" | "text-success" | "text-error"
  >("text-primary");

  const isOnline = useOnline();

  useEffect(() => {
    setTimeout(() => {
      if (isOnline === true) {
        setStatusColor("text-success");
      } else if (isOnline == false) {
        setStatusColor("text-error");
      }
    }, 500);
  }, [isOnline]);

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

        <div className="flex-none">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
