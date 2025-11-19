import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useParams } from "react-router";
import { localizeMonthToString } from "../helpers/localize";
import useKelas from "../hooks/useKelas";
import useGlobalLoading from "../hooks/useGlobalLoading";
import { getRekap } from "../helpers/api";
import useToken from "../hooks/useToken";
import { useState } from "react";
import Swal from "sweetalert2";

export default function MintaRekapDetail() {
  const { bulan_tahun } = useParams();
  const [kelas] = useKelas();
  const [bulan, tahun] = (bulan_tahun as string).split("-");
  const [, setLoading] = useGlobalLoading();
  const [token] = useToken();
  const [resultUrl, setResultUrl] = useState<string>();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!resultUrl) return;
    try {
      await navigator.clipboard.writeText(resultUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      
      // Opsional: Toast kecil
      const toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
      });
      toast.fire({ icon: 'success', title: 'Link disalin' });

    } catch (err) {
      console.error("Gagal menyalin link: ", err);
    }
  };

  // LOGIC SHARE (Web Share API)
  const handleShare = async () => {
    if (!resultUrl) return;

    const shareData = {
      title: 'Rekap Absensi',
      text: `Berikut adalah link rekap absensi untuk bulan ${localizeMonthToString(parseInt(bulan))} 20${tahun}`,
      url: resultUrl,
    };

    // Cek apakah browser mendukung fitur share native
    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Share dibatalkan user");
      }
    } else {
      // Fallback jika browser tidak support (misal di PC lama)
      handleCopy();
      Swal.fire({
        text: "Browser tidak mendukung fitur share native, link telah disalin ke clipboard.",
        icon: "info"
      });
    }
  };

  const handleDownload = async () => {
    if (!token || !kelas) return;
    setLoading(true);
    try {
        const fileId = await getRekap(
            token,
            parseInt(bulan),
            parseInt(tahun),
            kelas
        );
        const host = "https://" + window.location.host;
        const url = host + "/files/" + fileId + "/";
        setResultUrl(url);
    } catch (e) {
        Swal.fire({ title: "Gagal", text: "Gagal membuat rekap", icon: "error" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col font-sans pb-24">
      <Navbar />

      <main className="flex-grow p-6 md:p-10 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full space-y-6">
          
          {/* Header Info */}
          <div className="text-center">
             <div className="badge badge-primary badge-outline mb-2">Rekapitulasi Bulanan</div>
             <h1 className="text-3xl font-bold text-base-content">
                {localizeMonthToString(parseInt(bulan))} <span className="text-primary">20{tahun}</span>
             </h1>
             <p className="text-base-content/60 text-sm mt-1">Unduh atau bagikan laporan kehadiran siswa.</p>
          </div>

          {/* MAIN CARD */}
          <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
            
            {/* Jika Link Belum Ada (State Awal) */}
            {!resultUrl && (
                <div className="card-body items-center text-center py-10">
                    <div className="bg-base-200 p-4 rounded-full mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-base-content/50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                    </div>
                    <h3 className="font-bold text-lg">Siap untuk mengunduh?</h3>
                    <p className="text-sm text-base-content/60 mb-6">Klik tombol di bawah menghasilkan laporan</p>
                    <button 
                        className="btn btn-primary btn-wide shadow-lg hover:scale-105 transition-transform" 
                        onClick={handleDownload}
                    >
                        Buat File Rekap
                    </button>
                </div>
            )}

            {/* Jika Link Sudah Ada (State Sukses) */}
            {resultUrl && (
                <div className="card-body">
                    <div className="alert alert-success bg-success/10 border-success/20 text-success py-2 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>File berhasil dibuat!</span>
                    </div>
                    
                    <label className="label">
                        <span className="label-text font-semibold">Link Download</span>
                    </label>
                    
                    {/* Input Group untuk Copy Link */}
                    <div className="join w-full mb-6">
                        <input 
                            type="text" 
                            readOnly 
                            value={resultUrl} 
                            className="input input-bordered join-item w-full bg-base-200/50 text-sm" 
                        />
                        <button 
                            onClick={handleCopy} 
                            className="btn join-item btn-neutral border-base-300"
                            data-tip="Salin Link"
                        >
                            {isCopied ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-success"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                            )}
                        </button>
                    </div>

                    {/* ACTION BUTTONS GRID */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Tombol Buka Langsung */}
                        <a
                            href={resultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline border-base-300 hover:bg-base-200 hover:text-base-content"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                            Buka File
                        </a>

                        {/* Tombol Share (IG Style) */}
                        <button 
                            onClick={handleShare} 
                            className="btn btn-primary shadow-md"
                        >
                            {/* Paper Airplane Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 -rotate-45 translate-y-0.5 translate-x-0.5">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                            Share Link
                        </button>
                    </div>
                </div>
            )}

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}