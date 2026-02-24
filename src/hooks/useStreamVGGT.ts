import { useRef, useState, useCallback } from "react";
import type { ReconstructionFrame, ScanState } from "../types";

const WS_URL = import.meta.env.VITE_STREAMVGGT_WS_URL ?? "ws://localhost:8000/ws";
const KEYFRAME_INTERVAL_MS = 1500; // Send a frame every 1.5s

function parseServerResponse(data: Record<string, unknown>): ReconstructionFrame | null {
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
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);

  const [scanState, setScanState] = useState<ScanState>({
    isConnected: false,
    isScanning: false,
    framesSent: 0,
    latestFrame: null,
    accumulatedPoints: new Float32Array(0),
    accumulatedColors: new Float32Array(0),
    error: null,
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setScanState((prev) => ({ ...prev, isConnected: true, error: null }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const frame = parseServerResponse(data);
        if (!frame) return;

        setScanState((prev) => {
          // Accumulate points from all frames
          const newPoints = new Float32Array(
            prev.accumulatedPoints.length + frame.points.length
          );
          newPoints.set(prev.accumulatedPoints);
          newPoints.set(frame.points, prev.accumulatedPoints.length);

          const newColors = new Float32Array(
            prev.accumulatedColors.length + frame.colors.length
          );
          newColors.set(prev.accumulatedColors);
          newColors.set(frame.colors, prev.accumulatedColors.length);

          return {
            ...prev,
            latestFrame: frame,
            accumulatedPoints: newPoints,
            accumulatedColors: newColors,
          };
        });
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    ws.onclose = () => {
      setScanState((prev) => ({ ...prev, isConnected: false }));
    };

    ws.onerror = () => {
      setScanState((prev) => ({
        ...prev,
        isConnected: false,
        error: "WebSocket connection failed",
      }));
    };
  }, []);

  const sendFrame = useCallback((base64Jpeg: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Strip data URL prefix if present
    const b64 = base64Jpeg.replace(/^data:image\/\w+;base64,/, "");
    ws.send(JSON.stringify({ image: b64 }));

    setScanState((prev) => ({
      ...prev,
      framesSent: prev.framesSent + 1,
    }));
  }, []);

  const startScanning = useCallback(
    (captureFunction: () => string | null) => {
      captureRef.current = captureFunction;
      connect();

      // Wait for connection before starting to capture
      const checkAndStart = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          intervalRef.current = setInterval(() => {
            const dataUrl = captureRef.current?.();
            if (dataUrl) sendFrame(dataUrl);
          }, KEYFRAME_INTERVAL_MS);

          setScanState((prev) => ({ ...prev, isScanning: true }));
        } else {
          setTimeout(checkAndStart, 200);
        }
      };
      checkAndStart();
    },
    [connect, sendFrame]
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

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ reset: true }));
    }

    setScanState({
      isConnected: wsRef.current?.readyState === WebSocket.OPEN,
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
    wsRef.current?.close();
    wsRef.current = null;
  }, [stopScanning]);

  return {
    scanState,
    startScanning,
    stopScanning,
    reset,
    disconnect,
  };
}
