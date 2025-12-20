import { Link } from "react-router";

interface FooterProps {
  active?: "home" | "about";
}

export default function PiketFooter({ active }: FooterProps) {
  const piketRootPath = import.meta.env.VITE_PIKET_PATH;

  return (
    <div className="dock z-50">
      <Link
        to={piketRootPath}
        className={active == "home" ? "dock-active" : ""}
      >
        <svg
          className="size-[1.2em]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
        >
          <g fill="currentColor" strokeLinejoin="miter" strokeLinecap="butt">
            <polyline
              points="1 11 12 2 23 11"
              fill="none"
              stroke="currentColor"
              strokeMiterlimit="10"
              strokeWidth="2"
            ></polyline>
            <path
              d="m5,13v7c0,1.105.895,2,2,2h10c1.105,0,2-.895,2-2v-7"
              fill="none"
              stroke="currentColor"
              strokeLinecap="square"
              strokeMiterlimit="10"
              strokeWidth="2"
            ></path>
            <line
              x1="12"
              y1="22"
              x2="12"
              y2="18"
              fill="none"
              stroke="currentColor"
              strokeLinecap="square"
              strokeMiterlimit="10"
              strokeWidth="2"
            ></line>
          </g>
        </svg>
      </Link>

      <Link
        to={piketRootPath + "about"}
        className={active == "about" ? "dock-active" : ""}
      >
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
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
          />
        </svg>
      </Link>
    </div>
  );
}
