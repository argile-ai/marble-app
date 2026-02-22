import { Box } from "@chakra-ui/react";
import Webcam from "react-webcam";
import type { RefObject } from "react";

interface CameraViewfinderProps {
  webcamRef: RefObject<Webcam | null>;
}

export function CameraViewfinder({ webcamRef }: CameraViewfinderProps) {
  return (
    <Box
      position="relative"
      w="100%"
      h="100%"
      bg="black"
      overflow="hidden"
    >
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          facingMode: "environment",
          width: 1280,
          height: 720,
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {/* Crosshair */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="40px"
        h="40px"
        pointerEvents="none"
      >
        <Box
          position="absolute"
          top="50%"
          left="0"
          w="100%"
          h="1px"
          bg="whiteAlpha.600"
        />
        <Box
          position="absolute"
          top="0"
          left="50%"
          w="1px"
          h="100%"
          bg="whiteAlpha.600"
        />
      </Box>
    </Box>
  );
}
