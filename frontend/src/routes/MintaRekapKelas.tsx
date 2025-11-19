import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getKelas, type KelasProps } from "../helpers/database";
import useDatabase from "../hooks/useDatabase";
import useKelas from "../hooks/useKelas";
import { useNavigate } from "react-router";

export default function MintaAbsensiKelas() {
  const db = useDatabase();
  const [listKelas, setListKelas] = useState<KelasProps[]>([]);
  const [, setKelas] = useKelas();
  const navigate = useNavigate();

  useEffect(() => {
    if (db) {
      const kelas = getKelas({
        db,
      });
      setListKelas(kelas);
    }
  }, [db]);

  const handleClick = async (kelasId: number) => {
    setKelas(kelasId);
    navigate("/minta-rekap");
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      <main className="flex-grow p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          {/* Header Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-base-content">
              Daftar Kelas
            </h1>
          </div>

          {/* Grid Layout */}
          {listKelas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {listKelas.map((k) => {
                return (
                  <button
                    key={k.id}
                    onClick={() => handleClick(k.id)}
                    className="card bg-base-200 shadow-sm hover:shadow-md hover:border-primary border border-base-200 transition-all duration-200 group text-left"
                  >
                    <div className="card-body p-5 flex flex-row items-center gap-4">
                      <div className="flex-none">
                        <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="size-6"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Nama Kelas (Vertically Centered) */}
                      <div className="flex-grow">
                        <h2 className="font-bold text-lg text-base-content group-hover:text-primary transition-colors">
                          {k.name}
                        </h2>
                      </div>

                      {/* Chevron Arrow (Minimalis) */}
                      <div className="flex-none opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m8.25 4.5 7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
