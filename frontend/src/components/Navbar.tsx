import { Link } from "react-router";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {

  return (
    <div className="sticky top-0 z-50 w-full bg-base-100/90 backdrop-blur-lg border-b border-base-200 transition-all duration-300">
      <div className="navbar max-w-5xl mx-auto px-4 md:px-0">
        <div className="flex-1">
          <Link
            to="/"
            className="btn btn-ghost hover:bg-transparent px-0 text-2xl font-bold text-primary tracking-tight"
          >
            {/* Opsional: Tambahkan Ikon Kecil Disini jika ada */}
            <span className="text-base-content">Presen</span>see
            <span className="text-primary text-4xl leading-3">.</span>
          </Link>
        </div>
        
        <div className="flex-none">
          <ThemeToggle></ThemeToggle>
        </div>
      </div>
    </div>
  );
}