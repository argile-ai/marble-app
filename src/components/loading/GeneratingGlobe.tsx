import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

function RotatingGlobe() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.rotation.x += delta * 0.2;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color="#6366f1"
        wireframe
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

export function GeneratingGlobe() {
  return (
    <Canvas
      style={{ width: "160px", height: "160px" }}
      camera={{ position: [0, 0, 3] }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} />
      <RotatingGlobe />
    </Canvas>
  );
}
