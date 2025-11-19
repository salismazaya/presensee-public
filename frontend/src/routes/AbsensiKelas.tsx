import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getKelas, type KelasProps } from "../helpers/database";
import useDatabase from "../hooks/useDatabase";
import useKelas from "../hooks/useKelas";
import { useNavigate } from "react-router";

export default function AbsensiKelas() {
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
    navigate("/absensi");
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      <main className="flex-grow p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          
          {/* Header Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-base-content">Daftar Kelas</h1>
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
                    className="card bg-base-100 shadow-sm hover:shadow-md hover:border-primary border border-base-200 transition-all duration-200 group text-left"
                  >
                    <div className="card-body p-5 flex flex-row items-center gap-4">
                      
                      {/* Ikon Bulat (Fixed) */}
                      <div className="flex-none">
                        <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
                            <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
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
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
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

      <Footer active="users" />
    </div>
  );
}