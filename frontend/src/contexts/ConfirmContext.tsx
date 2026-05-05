import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [modalState, setModalState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const normalizedOptions = typeof options === "string" ? { message: options } : options;
      setModalState({
        isOpen: true,
        options: normalizedOptions,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (modalState) {
      modalState.resolve(true);
      setModalState(null);
    }
  };

  const handleCancel = () => {
    if (modalState) {
      modalState.resolve(false);
      setModalState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalState && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-9999">
          <div className="modal-box border border-base-300 shadow-2xl">
            <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
              {modalState.options.danger && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6 text-error"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              )}
              {modalState.options.title || "Konfirmasi"}
            </h3>
            <div className="py-4 text-base-content/80 text-lg">
              {typeof modalState.options.message === "string" ? (
                <p>{modalState.options.message}</p>
              ) : (
                modalState.options.message
              )}
            </div>
            <div className="modal-action gap-2">
              <button className="btn btn-ghost flex-1 sm:flex-none" onClick={handleCancel}>
                {modalState.options.cancelText || "Batal"}
              </button>
              <button
                className={`btn flex-1 sm:flex-none ${modalState.options.danger ? "btn-error" : "btn-primary"
                  }`}
                onClick={handleConfirm}
              >
                {modalState.options.confirmText || "Ya, Lanjutkan"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onClick={handleCancel}>
            <button>close</button>
          </form>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
};
