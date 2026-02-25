import { useState, useCallback } from "react";

const SPATIALLM_URL =
  import.meta.env.VITE_SPATIALLM_URL ??
  "https://argile--spatiallm-spatiallmservice-analyze.modal.run";

interface FloorPlanResult {
  walls: { ax: number; ay: number; bx: number; by: number; height: number; thickness: number }[];
  doors: { wall_id: number; x: number; y: number; width: number }[];
  windows: { wall_id: number; x: number; y: number; width: number }[];
  objects: { class_name: string; x: number; y: number; angle: number; width: number; depth: number }[];
  svg: string;
  num_walls: number;
  num_doors: number;
  num_windows: number;
  num_objects: number;
  inference_time_ms: number;
}

interface FloorPlanState {
  isLoading: boolean;
  result: FloorPlanResult | null;
  error: string | null;
}

export function useFloorPlan() {
  const [state, setState] = useState<FloorPlanState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const generateFloorPlan = useCallback(
    async (points: Float32Array, colors: Float32Array) => {
      setState({ isLoading: true, result: null, error: null });

      try {
        const response = await fetch(SPATIALLM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: Array.from(points),
            colors: Array.from(colors),
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data: FloorPlanResult = await response.json();

        if ("error" in data) {
          throw new Error((data as unknown as { error: string }).error);
        }

        setState({ isLoading: false, result: data, error: null });
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ isLoading: false, result: null, error: message });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  return { ...state, generateFloorPlan, reset };
}
