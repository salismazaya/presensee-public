import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import { getBulan } from "../helpers/api";
import useToken from "../hooks/useToken";
import useGlobalLoading from "../hooks/useGlobalLoading";
import { Link } from "react-router";

export default function MintaRekap() {
  const [bulans, setBulans] = useState<{ bulan: string; bulan_humanize: string }[]>([]);
  const [token] = useToken();
  const [isLoading, setLoading] = useGlobalLoading(); // Asumsi hook ini mengembalikan state loading juga

  useEffect(() => {
    setLoading(true);
    if (!token) return;
    getBulan(token).then((result) => {
      setBulans(result);
      setLoading(false);
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      <main className="flex-grow p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          
          {/* Header Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-base-content">Unduh Laporan</h1>
            <p className="text-base-content/60 mt-2 max-w-md mx-auto">
              Pilih bulan untuk mengunduh rekapitulasi absensi dalam format laporan.
            </p>
          </div>

          {/* Content Section */}
          {bulans.length === 0 && !isLoading ? (
             <div className="card bg-base-100 shadow-sm border border-base-200 p-10 text-center">
                <p className="text-base-content/50">Belum ada data bulan rekap tersedia.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {bulans.map((bulan) => {
                return (
                  <Link 
                    key={bulan.bulan} 
                    to={"/minta-rekap/" + bulan.bulan} 
                    className="card bg-base-100 hover:bg-base-100 shadow-sm hover:shadow-md border border-base-200 hover:border-primary transition-all duration-200 group text-left"
                  >
                    <div className="card-body p-5 flex flex-row items-center justify-between">
                      
                      <div className="flex items-center gap-4">
                        {/* Calendar Icon Box */}
                        <div className="w-10 h-10 rounded-lg bg-base-200 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center transition-colors">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
                            </svg>
                        </div>
                        
                        {/* Text */}
                        <div>
                          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                             {bulan.bulan_humanize}
                          </h3>
                          <p className="text-xs text-base-content/50">Ketuk untuk unduh</p>
                        </div>
                      </div>

                      {/* Arrow Icon */}
                      <div className="text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>

                    </div>
                  </Link>
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