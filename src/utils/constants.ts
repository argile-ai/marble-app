export const TOTAL_CAPTURE_TARGETS = 16;
export const GENERATION_DURATION_MS = 15_000;

export const TARGET_POSITIONS: Array<{ x: number; y: number }> = Array.from(
  { length: TOTAL_CAPTURE_TARGETS },
  (_, i) => {
    const angle = (i / TOTAL_CAPTURE_TARGETS) * Math.PI * 2;
    const radius = i % 2 === 0 ? 0.3 : 0.2;
    return {
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
    };
  }
);

export const DEMO_ASSETS = [
  {
    id: "demo-1",
    title: "Living Room",
    status: "complete" as const,
    thumbnailUrl: "/assets/scene-thumbnail.jpg",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "demo-2",
    title: "Kitchen Corner",
    status: "complete" as const,
    thumbnailUrl: "/assets/scene-thumbnail.jpg",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "demo-3",
    title: "Office Desk",
    status: "complete" as const,
    thumbnailUrl: "/assets/scene-thumbnail.jpg",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];
