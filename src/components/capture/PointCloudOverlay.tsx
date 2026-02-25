import { useMemo, useEffect, useRef } from "react";
import { Box } from "@chakra-ui/react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function PointCloud({
  points,
  colors,
}: {
  points: Float32Array;
  colors: Float32Array;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (points.length === 0) return geo;
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    if (colors.length > 0) {
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }
    geo.computeBoundingSphere();
    return geo;
  }, [points, colors]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.02}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
}

/** Auto-fit camera to encompass the point cloud bounding sphere */
function AutoFit({ points }: { points: Float32Array }) {
  const { camera } = useThree();
  const fitted = useRef(false);

  useEffect(() => {
    if (points.length < 9) return; // need at least 3 points
    // Only auto-fit once (on first data), don't fight user's orbit
    if (fitted.current) return;
    fitted.current = true;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.computeBoundingSphere();
    const sphere = geo.boundingSphere;
    if (!sphere) return;

    const dist = sphere.radius * 2.5;
    camera.position.set(
      sphere.center.x,
      sphere.center.y + dist * 0.4,
      sphere.center.z + dist,
    );
    camera.lookAt(sphere.center);
    geo.dispose();
  }, [points, camera]);

  return null;
}

interface PointCloudOverlayProps {
  points: Float32Array;
  colors: Float32Array;
  cameraPose: number[] | null;
  extrinsic: number[] | null;
}

export function PointCloudOverlay({
  points,
  colors,
}: PointCloudOverlayProps) {
  return (
    <Box
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      h="50%"
      bg="gray.950"
      borderTopWidth="1px"
      borderColor="whiteAlpha.200"
      zIndex={5}
    >
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 2, 5], fov: 50, near: 0.01, far: 200 }}
        gl={{ alpha: false }}
      >
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.4} />
        <PointCloud points={points} colors={colors} />
        <AutoFit points={points} />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          maxDistance={50}
          minDistance={0.3}
        />
      </Canvas>
    </Box>
  );
}
