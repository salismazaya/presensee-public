import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const currentTheme = localStorage.getItem("THEME") || "light";
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("THEME", theme);
  }, [theme]);

  const toggleTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTheme(e.target.checked ? "dark" : "light");
  };

  return (
    <label className="swap swap-rotate btn btn-circle btn-ghost text-base-content shadow-sm bg-base-100/50 hover:bg-base-100">
      {/* this hidden checkbox controls the state */}
      <input 
        type="checkbox" 
        onChange={toggleTheme} 
        checked={theme === "dark"} 
      />

      {/* sun icon (Show when checked/dark mode) */}
      <svg
        className="swap-on fill-current w-6 h-6 text-warning"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.71.71l.71-.71A1,1,0,0,0,7.05,5.64l-.71-.71A1,1,0,0,0,5.64,7.05Zm13,1.41a1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,20.36,5.64l-.71.71A1,1,0,0,0,18.64,8.46Zm-2.83,13.37a1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,17.66,19.71l-.71.71A1,1,0,0,0,15.81,21.83ZM12,19a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19Zm7-7a1,1,0,0,0,1-1h1a1,1,0,0,0,0-2H19a1,1,0,0,0-1,1ZM12,7a5,5,0,1,0,5,5A5,5,0,0,0,12,7Z" />
      </svg>

      {/* moon icon (Show when unchecked/light mode) */}
      <svg
        className="swap-off fill-current w-6 h-6 text-primary"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
      >
        <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
      </svg>
    </label>
  );
}