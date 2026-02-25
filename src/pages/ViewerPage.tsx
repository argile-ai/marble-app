import { useState, useMemo } from "react";
import { Box, Text, Flex, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Map, Loader } from "lucide-react";
import { MobileContainer } from "../components/layout/MobileContainer";
import { ViewerControls } from "../components/viewer/ViewerControls";
import { FloorPlanModal } from "../components/viewer/FloorPlanModal";
import { VirtualJoystick } from "../components/viewer/VirtualJoystick";
import { CameraController } from "../components/viewer/CameraController";
import { useJoystick } from "../hooks/useJoystick";
import { useFloorPlan } from "../hooks/useFloorPlan";
import { useScanStore } from "../stores/scanStore";

function ScanPointCloud({
  points,
  colors,
}: {
  points: Float32Array;
  colors: Float32Array;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
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
        size={0.015}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
}

function PlaceholderScene() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6366f1" wireframe />
      </mesh>
      <gridHelper args={[10, 10, "#444", "#222"]} />
    </group>
  );
}

export function ViewerPage() {
  const navigate = useNavigate();
  const { containerRef, joystickData } = useJoystick();
  const { getScanData } = useScanStore();
  const [scanData] = useState(() => getScanData());
  const { isLoading, result, generateFloorPlan, reset } = useFloorPlan();
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  const hasPointCloud = scanData && scanData.points.length > 0;
  const totalPoints = hasPointCloud ? Math.floor(scanData.points.length / 3) : 0;

  const handleGenerateFloorPlan = async () => {
    if (!scanData) return;
    const data = await generateFloorPlan(scanData.points, scanData.colors);
    if (data) {
      setShowFloorPlan(true);
    }
  };

  return (
    <MobileContainer bg="black">
      <Box position="relative" h="100svh">
        <Canvas
          camera={{ position: [0, 3, 6], fov: 60, near: 0.01, far: 200 }}
          style={{ width: "100%", height: "100%" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={0.5} />
          {hasPointCloud ? (
            <ScanPointCloud
              points={scanData.points}
              colors={scanData.colors}
            />
          ) : (
            <PlaceholderScene />
          )}
          <CameraController joystickData={joystickData} />
          <OrbitControls
            enablePan
            maxDistance={50}
            minDistance={0.5}
          />
        </Canvas>

        <ViewerControls onBack={() => navigate("/profile")} />
        <VirtualJoystick containerRef={containerRef} />

        {/* Top bar: point count + floor plan button */}
        {hasPointCloud && (
          <Flex
            position="absolute"
            top={4}
            left="50%"
            transform="translateX(-50%)"
            gap={2}
            zIndex={10}
          >
            <Flex
              bg="blackAlpha.600"
              px={3}
              py={1}
              borderRadius="full"
              align="center"
            >
              <Text fontSize="xs" color="whiteAlpha.800">
                {totalPoints.toLocaleString()} points
              </Text>
            </Flex>
            <Button
              size="sm"
              borderRadius="full"
              bg="blackAlpha.600"
              color="white"
              _hover={{ bg: "blackAlpha.700" }}
              onClick={handleGenerateFloorPlan}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Map size={14} />
              )}
              <Text ml={1} fontSize="xs">
                {isLoading ? "Analyzing..." : "Floor Plan"}
              </Text>
            </Button>
          </Flex>
        )}

        {/* Floor Plan modal */}
        {showFloorPlan && result && (
          <FloorPlanModal
            svg={result.svg}
            numWalls={result.num_walls}
            numDoors={result.num_doors}
            numWindows={result.num_windows}
            numObjects={result.num_objects}
            inferenceTimeMs={result.inference_time_ms}
            onClose={() => {
              setShowFloorPlan(false);
              reset();
            }}
          />
        )}

        {!hasPointCloud && (
          <Flex
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="blackAlpha.600"
            px={4}
            py={3}
            borderRadius="xl"
            zIndex={10}
          >
            <Text fontSize="sm" color="whiteAlpha.700" textAlign="center">
              No scan data.{"\n"}Go back and capture a scene first.
            </Text>
          </Flex>
        )}
      </Box>
    </MobileContainer>
  );
}
