import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { JoystickData } from "../types";

const MOVE_SPEED = 5;

export function useCameraMovement(joystickData: JoystickData) {
  const { camera } = useThree();
  const direction = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!joystickData.active) return;

    direction.current.set(joystickData.x, 0, -joystickData.y);
    direction.current.applyQuaternion(camera.quaternion);
    direction.current.y = 0;
    direction.current.normalize().multiplyScalar(MOVE_SPEED * delta);

    camera.position.add(direction.current);
  });
}
