//src/hooks/useDebouncedSave.ts

import { useEffect, useRef } from "react";

export function useDebouncedSave(callback: () => void, delay: number, deps: any[]) {
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handler = setTimeout(() => callback(), delay);
    return () => clearTimeout(handler);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
