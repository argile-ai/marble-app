import { useEffect, useCallback } from "react";
import { Box, Flex, Button, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { X, RotateCcw, ScanLine } from "lucide-react";
import { MobileContainer } from "../components/layout/MobileContainer";
import { CameraViewfinder } from "../components/capture/CameraViewfinder";
import { PointCloudOverlay } from "../components/capture/PointCloudOverlay";
import { ScanStatusHUD } from "../components/capture/ScanStatusHUD";
import { IconButton } from "../components/ui/IconButton";
import { useCamera } from "../hooks/useCamera";
import { useStreamVGGT } from "../hooks/useStreamVGGT";
import { useScanStore } from "../stores/scanStore";
import { useAssets } from "../stores/assetStore";

export function CapturePage() {
  const navigate = useNavigate();
  const { webcamRef, capture } = useCamera();
  const { scanState, startScanning, stopScanning, reset, disconnect } =
    useStreamVGGT();
  const { setScanData } = useScanStore();
  const { dispatch } = useAssets();

  const handleStartScan = useCallback(() => {
    startScanning(capture);
  }, [startScanning, capture]);

  const handleStopScan = useCallback(() => {
    stopScanning();
  }, [stopScanning]);

  const handleFinish = () => {
    stopScanning();

    // Save the accumulated point cloud for the viewer
    const { accumulatedPoints, accumulatedColors } = scanState;
    setScanData({
      points: accumulatedPoints,
      colors: accumulatedColors,
    });

    // Create an asset entry
    const newId = crypto.randomUUID();
    dispatch({
      type: "ADD_ASSET",
      payload: {
        id: newId,
        title: "Scan " + new Date().toLocaleTimeString(),
        status: "complete",
        thumbnailUrl: "/assets/scene-thumbnail.jpg",
        createdAt: new Date(),
      },
    });

    // Go directly to viewer
    navigate(`/viewer/${newId}`);
  };

  const handleClose = () => {
    disconnect();
    navigate("/profile");
  };

  const handleReset = () => {
    reset();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const { isScanning, framesSent, accumulatedPoints, accumulatedColors } =
    scanState;
  const hasPoints = accumulatedPoints.length > 0;
  const latestExtrinsic = scanState.latestFrame?.extrinsic ?? null;
  const latestCameraPose = scanState.latestFrame?.cameraPose ?? null;

  return (
    <MobileContainer bg="black">
      <Box position="relative" h="100svh" overflow="hidden">
        {/* Full-screen camera feed */}
        <Box position="absolute" inset={0}>
          <CameraViewfinder webcamRef={webcamRef} />
        </Box>

        {/* Point cloud overlaid on camera */}
        {hasPoints && (
          <PointCloudOverlay
            points={accumulatedPoints}
            colors={accumulatedColors}
            cameraPose={latestCameraPose}
            extrinsic={latestExtrinsic}
          />
        )}

        {/* Top bar */}
        <Flex
          justify="space-between"
          align="center"
          px={2}
          pt={2}
          position="absolute"
          top={0}
          left={0}
          right={0}
          zIndex={20}
        >
          <IconButton
            icon={<RotateCcw size={20} />}
            label="Reset scan"
            onClick={handleReset}
          />
          <IconButton
            icon={<X size={20} color="#ef4444" />}
            label="Close"
            onClick={handleClose}
          />
        </Flex>

        {/* Scan instructions (center) */}
        {!isScanning && !hasPoints && (
          <Flex
            position="absolute"
            top="40%"
            left="50%"
            transform="translate(-50%, -50%)"
            direction="column"
            align="center"
            gap={2}
            zIndex={10}
          >
            <ScanLine size={48} color="white" opacity={0.7} />
            <Text color="whiteAlpha.800" fontSize="sm" textAlign="center">
              Tap Start to begin scanning.{"\n"}Move your phone slowly around
              the room.
            </Text>
          </Flex>
        )}

        {/* Scanning indicator (top center) */}
        {isScanning && (
          <Box
            position="absolute"
            top={14}
            left="50%"
            transform="translateX(-50%)"
            bg="green.500"
            px={3}
            py={1}
            borderRadius="full"
            zIndex={10}
          >
            <Flex align="center" gap={2}>
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg="white"
              />
              <Text fontSize="xs" color="white" fontWeight="semibold">
                SCANNING
              </Text>
            </Flex>
          </Box>
        )}

        {/* Bottom controls - fixed to viewport bottom */}
        <Flex
          direction="column"
          gap={3}
          position="fixed"
          bottom={0}
          left={0}
          right={0}
          maxW="md"
          mx="auto"
          px={4}
          pt={4}
          pb="max(env(safe-area-inset-bottom), 24px)"
          align="center"
          zIndex={20}
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)",
          }}
        >
          <ScanStatusHUD scanState={scanState} />

          <Flex gap={3} justify="center">
            {!isScanning ? (
              <Button
                colorPalette="green"
                size="lg"
                borderRadius="full"
                px={8}
                onClick={handleStartScan}
              >
                {framesSent > 0 ? "Resume" : "Start Scan"}
              </Button>
            ) : (
              <Button
                colorPalette="yellow"
                size="lg"
                borderRadius="full"
                px={8}
                onClick={handleStopScan}
              >
                Pause
              </Button>
            )}

            {framesSent > 0 && !isScanning && (
              <Button
                colorPalette="blue"
                size="lg"
                borderRadius="full"
                px={8}
                onClick={handleFinish}
              >
                Done
              </Button>
            )}
          </Flex>
        </Flex>
      </Box>
    </MobileContainer>
  );
}
