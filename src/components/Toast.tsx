import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000); // auto-hide after 3s
    return () => clearTimeout(timer);
  }, [onClose]);

  const color =
    type === "success"
      ? "bg-green-100 text-green-700 border-green-300"
      : type === "error"
      ? "bg-red-100 text-red-700 border-red-300"
      : "bg-blue-100 text-blue-700 border-blue-300";

  return (
    <div
      className={`fixed top-4 right-4 px-4 py-2 border rounded-lg shadow-sm z-50 animate-fade-in ${color}`}
    >
      {message}
    </div>
  );
}
