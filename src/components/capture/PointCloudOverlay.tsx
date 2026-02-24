import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface PointCloudProps {
  points: Float32Array;
  colors: Float32Array;
  cameraPose: number[] | null;
}

function PointCloud({ points, colors }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    if (points.length === 0) return geo;

    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

    if (colors.length > 0) {
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }

    return geo;
  }, [points, colors]);

  useFrame(() => {
    if (pointsRef.current) {
      // Gentle rotation for visual feedback when no pose data
      pointsRef.current.rotation.y += 0.001;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.02}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function CameraSyncController({
  extrinsic,
}: {
  extrinsic: number[] | null;
}) {
  useFrame(({ camera }) => {
    if (!extrinsic || extrinsic.length !== 12) return;

    // extrinsic is a 3x4 row-major [R|t] matrix (camera-from-world, OpenCV)
    // Convert to Three.js camera matrix (world-from-camera)
    const m = new THREE.Matrix4();

    // Build 4x4 from 3x4 OpenCV [R|t]
    m.set(
      extrinsic[0], extrinsic[1], extrinsic[2], extrinsic[3],
      extrinsic[4], extrinsic[5], extrinsic[6], extrinsic[7],
      extrinsic[8], extrinsic[9], extrinsic[10], extrinsic[11],
      0, 0, 0, 1
    );

    // Invert to get world-from-camera
    m.invert();

    // OpenCV to Three.js: flip Y and Z
    const flipYZ = new THREE.Matrix4().makeScale(1, -1, -1);
    m.multiply(flipYZ);

    camera.matrix.copy(m);
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    camera.matrixWorldNeedsUpdate = true;
  });

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
  cameraPose,
  extrinsic,
}: PointCloudOverlayProps) {
  return (
    <Canvas
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background: "transparent",
      }}
      gl={{ alpha: true }}
      camera={{ position: [0, 2, 5], fov: 60, near: 0.01, far: 100 }}
    >
      <PointCloud points={points} colors={colors} cameraPose={cameraPose} />
      <CameraSyncController extrinsic={extrinsic} />
    </Canvas>
  );
}
