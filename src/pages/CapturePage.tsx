import { Box, Flex } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { Undo2, X } from "lucide-react";
import { MobileContainer } from "../components/layout/MobileContainer";
import { CameraViewfinder } from "../components/capture/CameraViewfinder";
import { TargetDots } from "../components/capture/TargetDots";
import { CaptureProgress } from "../components/capture/CaptureProgress";
import { CaptureControls } from "../components/capture/CaptureControls";
import { IconButton } from "../components/ui/IconButton";
import { useCamera } from "../hooks/useCamera";
import { usePhotoSession } from "../hooks/usePhotoSession";

export function CapturePage() {
  const navigate = useNavigate();
  const { webcamRef, capture } = useCamera();
  const { progress, total, isComplete, addPhoto, undo } = usePhotoSession();

  const handleCapture = () => {
    const dataUrl = capture();
    if (dataUrl) addPhoto(dataUrl);
  };

  const handleFinish = () => {
    navigate("/generating");
  };

  const handleClose = () => {
    navigate("/profile");
  };

  return (
    <MobileContainer bg="black">
      <Flex direction="column" h="dvh">
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
          zIndex={10}
        >
          <IconButton
            icon={<Undo2 size={20} />}
            label="Undo"
            onClick={undo}
          />
          <IconButton
            icon={<X size={20} color="#ef4444" />}
            label="Close"
            onClick={handleClose}
          />
        </Flex>

        {/* Camera */}
        <Box flex={1} position="relative">
          <CameraViewfinder webcamRef={webcamRef} />
          <TargetDots capturedCount={progress} />
        </Box>

        {/* Bottom controls */}
        <Box bg="black">
          <CaptureProgress progress={progress} total={total} />
          <CaptureControls
            onCapture={handleCapture}
            onFinish={handleFinish}
            isComplete={isComplete}
            canUndo={progress > 0}
            onUndo={undo}
          />
        </Box>
      </Flex>
    </MobileContainer>
  );
}
