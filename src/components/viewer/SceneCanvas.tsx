import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SceneModel } from "./SceneModel";
import { CameraController } from "./CameraController";
import type { JoystickData } from "../../types";

interface SceneCanvasProps {
  joystickData: JoystickData;
}

export function SceneCanvas({ joystickData }: SceneCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 3, 6], fov: 60 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <SceneModel />
      <CameraController joystickData={joystickData} />
      <OrbitControls
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={20}
      />
    </Canvas>
  );
}
