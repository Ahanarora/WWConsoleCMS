import { useState, useCallback, ReactElement } from "react";
import Toast from "../components/Toast";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type?: ToastType } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, type?: ToastType) => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  // explicitly annotate the element so TS doesn't confuse JSX for type syntax
  const ToastContainer: ReactElement | null = toast ? (
    <Toast message={toast.message} type={toast.type} onClose={hideToast} />
  ) : null;

  return { showToast, ToastContainer };
}
