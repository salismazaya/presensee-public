import { createContext, useEffect, useState, type JSX } from "react";
import { ping } from "../helpers/api";

type OnlineProps = {
  isOnline?: boolean;
};

export function OnlineContextConsumer({ children }: { children: JSX.Element }) {
  const [isOnline, setIsOnline] = useState<boolean>();

  useEffect(() => {
    ping()
      .then(() => {
        setIsOnline(true);
      })
      .catch(() => {
        setIsOnline(false);
      });
  }, []);

  return (
    <OnlineContext
      value={{
        isOnline,
      }}
    >
      {children}
    </OnlineContext>
  );
}

const OnlineContext = createContext<OnlineProps>({});

export default OnlineContext;
