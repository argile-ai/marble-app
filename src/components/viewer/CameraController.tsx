import type { JoystickData } from "../../types";
import { useCameraMovement } from "../../hooks/useCameraMovement";

interface CameraControllerProps {
  joystickData: JoystickData;
}

export function CameraController({ joystickData }: CameraControllerProps) {
  useCameraMovement(joystickData);
  return null;
}
