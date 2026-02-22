import { useRef, useCallback } from "react";
import Webcam from "react-webcam";

export function useCamera() {
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback((): string | null => {
    return webcamRef.current?.getScreenshot() ?? null;
  }, []);

  return { webcamRef, capture };
}
