import { useState, useCallback } from "react";
import type { Photo } from "../types";
import { TOTAL_CAPTURE_TARGETS } from "../utils/constants";

export function usePhotoSession() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  const addPhoto = useCallback(
    (dataUrl: string) => {
      if (photos.length >= TOTAL_CAPTURE_TARGETS) return;
      const photo: Photo = {
        id: crypto.randomUUID(),
        dataUrl,
        targetIndex: photos.length,
      };
      setPhotos((prev) => [...prev, photo]);
    },
    [photos.length]
  );

  const undo = useCallback(() => {
    setPhotos((prev) => prev.slice(0, -1));
  }, []);

  const reset = useCallback(() => {
    setPhotos([]);
  }, []);

  return {
    photos,
    progress: photos.length,
    total: TOTAL_CAPTURE_TARGETS,
    isComplete: photos.length >= TOTAL_CAPTURE_TARGETS,
    addPhoto,
    undo,
    reset,
  };
}
