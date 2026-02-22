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
