import { createContext, useEffect, useState, type JSX } from "react";
import init, {
  get_author_name,
  get_author_site,
  get_github_url,
  get_welcome_message,
} from "../pkg/presensee_wasm";

type ConstantsProps = {
  AUTHOR_NAME: string;
  AUTHOR_SITE: string;
  WELCOME_MESSAGE: string;
  GITHUB_URL: string;
};

export function ConstantsContextConsumer({
  children,
}: {
  children: JSX.Element;
}) {
  const [constans, setConstants] = useState<ConstantsProps>({
    AUTHOR_NAME: "",
    AUTHOR_SITE: "",
    GITHUB_URL: "",
    WELCOME_MESSAGE: "",
  });

  useEffect(() => {
    init().then(() => {
      setConstants({
        AUTHOR_NAME: get_author_name(),
        AUTHOR_SITE: get_author_site(),
        GITHUB_URL: get_github_url(),
        WELCOME_MESSAGE: get_welcome_message(),
      });
    });
  }, []);

  return <ConstantsContext value={constans}>{children}</ConstantsContext>;
}

const ConstantsContext = createContext<ConstantsProps>({
  AUTHOR_NAME: "",
  AUTHOR_SITE: "",
  GITHUB_URL: "",
  WELCOME_MESSAGE: "",
});

export default ConstantsContext;
