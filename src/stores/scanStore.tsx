import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

interface ScanData {
  points: Float32Array;
  colors: Float32Array;
}

interface ScanStore {
  getScanData: () => ScanData | null;
  setScanData: (data: ScanData) => void;
  clearScanData: () => void;
}

const ScanContext = createContext<ScanStore | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const dataRef = useRef<ScanData | null>(null);

  const getScanData = useCallback(() => dataRef.current, []);
  const setScanData = useCallback((data: ScanData) => {
    dataRef.current = data;
  }, []);
  const clearScanData = useCallback(() => {
    dataRef.current = null;
  }, []);

  return (
    <ScanContext.Provider value={{ getScanData, setScanData, clearScanData }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanStore() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScanStore must be used within ScanProvider");
  return ctx;
}
