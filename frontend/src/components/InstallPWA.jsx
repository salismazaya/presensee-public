import React, { useEffect, useState } from "react";

const InstallPWA = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      console.log("we are being triggered :D");
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    
    // Mendengarkan event 'beforeinstallprompt'
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("transitionend", handler);
  }, []);

  const onClick = (evt) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }
    // Tampilkan prompt install asli browser
    promptInstall.prompt();
  };

  if (!supportsPWA) {
    return null; // Jangan tampilkan tombol jika browser tidak support atau sudah diinstall
  }

  return (
    <button
      className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg z-50"
      id="setup_button"
      aria-label="Install app"
      title="Install App"
      onClick={onClick}
    >
      Install Aplikasi
    </button>
  );
};

export default InstallPWA;