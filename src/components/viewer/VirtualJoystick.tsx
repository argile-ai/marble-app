import { Box } from "@chakra-ui/react";
import type { RefObject } from "react";

interface VirtualJoystickProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

export function VirtualJoystick({ containerRef }: VirtualJoystickProps) {
  return (
    <Box
      ref={containerRef}
      position="absolute"
      bottom={0}
      left="50%"
      transform="translateX(-50%)"
      w="200px"
      h="200px"
      zIndex={10}
    />
  );
}
