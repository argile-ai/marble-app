import { Box as DreiBox, Sphere, Plane } from "@react-three/drei";

export function SceneModel() {
  return (
    <group>
      {/* Ground plane */}
      <Plane args={[20, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <meshStandardMaterial color="#4a5568" />
      </Plane>

      {/* Placeholder objects */}
      <DreiBox args={[1, 1, 1]} position={[-2, 0.5, -1]}>
        <meshStandardMaterial color="#e53e3e" />
      </DreiBox>

      <DreiBox args={[1.5, 2, 1]} position={[2, 0.5, -2]}>
        <meshStandardMaterial color="#3182ce" />
      </DreiBox>

      <Sphere args={[0.6, 32, 32]} position={[0, 0.6, 1]}>
        <meshStandardMaterial color="#38a169" />
      </Sphere>

      <DreiBox args={[0.8, 0.8, 0.8]} position={[1, 0.4, 2]}>
        <meshStandardMaterial color="#d69e2e" />
      </DreiBox>

      <Sphere args={[0.4, 32, 32]} position={[-1.5, 0.4, 2.5]}>
        <meshStandardMaterial color="#9f7aea" />
      </Sphere>
    </group>
  );
}
