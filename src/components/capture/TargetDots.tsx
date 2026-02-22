import { Box } from "@chakra-ui/react";
import { TARGET_POSITIONS } from "../../utils/constants";

interface TargetDotsProps {
  capturedCount: number;
}

export function TargetDots({ capturedCount }: TargetDotsProps) {
  return (
    <Box position="absolute" inset={0} pointerEvents="none">
      {TARGET_POSITIONS.map((pos, i) => {
        const isCaptured = i < capturedCount;
        const isNext = i === capturedCount;
        return (
          <Box
            key={i}
            position="absolute"
            left={`${pos.x * 100}%`}
            top={`${pos.y * 100}%`}
            transform="translate(-50%, -50%)"
            w={isNext ? "14px" : "10px"}
            h={isNext ? "14px" : "10px"}
            borderRadius="full"
            bg={isCaptured ? "green.500" : isNext ? "green.400" : "green.300"}
            opacity={isCaptured ? 0.4 : isNext ? 1 : 0.7}
            boxShadow={isNext ? "0 0 8px rgba(34,197,94,0.6)" : "none"}
            transition="all 0.2s"
          />
        );
      })}
    </Box>
  );
}
