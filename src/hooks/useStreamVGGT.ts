import { useRef, useState, useCallback } from "react";
import type { ReconstructionFrame, ScanState } from "../types";

// HTTP POST endpoint (WebSocket is broken by a Modal platform bug)
const API_URL = import.meta.env.VITE_STREAMVGGT_URL ?? "";
const KEYFRAME_INTERVAL_MS = 1500;

function parseServerResponse(
  data: Record<string, unknown>,
): ReconstructionFrame | null {
  if (data.error) {
    console.error("Server error:", data.error);
    return null;
  }

  const points = data.points as number[];
  const colors = data.colors as number[];
  const confidence = data.confidence as number[];

  if (!points || points.length === 0) return null;

  return {
    points: new Float32Array(points),
    colors: new Float32Array(colors),
    confidence: new Float32Array(confidence),
    cameraPose: data.camera_pose as number[],
    extrinsic: data.extrinsic as number[],
    intrinsic: data.intrinsic as number[],
    numPoints: data.num_points as number,
    frameIndex: data.frame_index as number,
    totalFrames: data.total_frames as number,
    inferenceTimeMs: data.inference_time_ms as number,
  };
}

export function useStreamVGGT() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const busyRef = useRef(false); // prevent overlapping requests

  const [scanState, setScanState] = useState<ScanState>({
    isConnected: false,
    isScanning: false,
    framesSent: 0,
    latestFrame: null,
    accumulatedPoints: new Float32Array(0),
    accumulatedColors: new Float32Array(0),
    error: null,
  });

  const sendFrame = useCallback(async (base64Jpeg: string) => {
    if (!API_URL || busyRef.current) return;
    busyRef.current = true;

    const b64 = base64Jpeg.replace(/^data:image\/\w+;base64,/, "");

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64 }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const frame = parseServerResponse(data);

      setScanState((prev) => {
        const next = {
          ...prev,
          isConnected: true,
          error: null,
          framesSent: prev.framesSent + 1,
        };

        if (frame) {
          const newPoints = new Float32Array(
            prev.accumulatedPoints.length + frame.points.length,
          );
          newPoints.set(prev.accumulatedPoints);
          newPoints.set(frame.points, prev.accumulatedPoints.length);

          const newColors = new Float32Array(
            prev.accumulatedColors.length + frame.colors.length,
          );
          newColors.set(prev.accumulatedColors);
          newColors.set(frame.colors, prev.accumulatedColors.length);

          next.latestFrame = frame;
          next.accumulatedPoints = newPoints;
          next.accumulatedColors = newColors;
        }

        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Frame POST failed:", msg);
      setScanState((prev) => ({
        ...prev,
        error: `Server error: ${msg}. Retrying…`,
      }));
    } finally {
      busyRef.current = false;
    }
  }, []);

  const startScanning = useCallback(
    (captureFunction: () => string | null) => {
      captureRef.current = captureFunction;

      setScanState((prev) => ({ ...prev, isScanning: true, error: null }));

      if (!API_URL) {
        console.warn("No VITE_STREAMVGGT_URL configured, running in offline mode");
        setScanState((prev) => ({
          ...prev,
          error: "No server URL configured",
        }));
      }

      intervalRef.current = setInterval(() => {
        const dataUrl = captureRef.current?.();
        if (dataUrl) sendFrame(dataUrl);
      }, KEYFRAME_INTERVAL_MS);
    },
    [sendFrame],
  );

  const stopScanning = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setScanState((prev) => ({ ...prev, isScanning: false }));
  }, []);

  const reset = useCallback(() => {
    stopScanning();

    // Tell the server to clear its frame buffer
    if (API_URL) {
      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      }).catch(() => {});
    }

    setScanState({
      isConnected: false,
      isScanning: false,
      framesSent: 0,
      latestFrame: null,
      accumulatedPoints: new Float32Array(0),
      accumulatedColors: new Float32Array(0),
      error: null,
    });
  }, [stopScanning]);

  const disconnect = useCallback(() => {
    stopScanning();
    busyRef.current = false;
  }, [stopScanning]);

  return {
    scanState,
    startScanning,
    stopScanning,
    reset,
    disconnect,
  };
}
