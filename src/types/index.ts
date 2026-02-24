export interface Asset {
  id: string;
  title: string;
  status: "processing" | "complete" | "failed";
  thumbnailUrl: string;
  createdAt: Date;
}

export interface Photo {
  id: string;
  dataUrl: string;
  targetIndex: number;
}

export interface JoystickData {
  x: number;
  y: number;
  active: boolean;
}

export interface ReconstructionFrame {
  points: Float32Array;
  colors: Float32Array;
  confidence: Float32Array;
  cameraPose: number[];
  extrinsic: number[];
  intrinsic: number[];
  numPoints: number;
  frameIndex: number;
  totalFrames: number;
  inferenceTimeMs: number;
}

export interface ScanState {
  isConnected: boolean;
  isScanning: boolean;
  framesSent: number;
  latestFrame: ReconstructionFrame | null;
  accumulatedPoints: Float32Array;
  accumulatedColors: Float32Array;
  error: string | null;
}
