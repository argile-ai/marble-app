import { Box, Flex, Text } from "@chakra-ui/react";
import type { ScanState } from "../../types";

interface ScanStatusHUDProps {
  scanState: ScanState;
}

export function ScanStatusHUD({ scanState }: ScanStatusHUDProps) {
  const { isConnected, isScanning, framesSent, latestFrame } = scanState;

  const totalPoints = Math.floor(
    scanState.accumulatedPoints.length / 3
  );

  return (
    <Box
      position="absolute"
      bottom={20}
      left="50%"
      transform="translateX(-50%)"
      bg="blackAlpha.700"
      borderRadius="xl"
      px={4}
      py={2}
      zIndex={10}
      minW="200px"
    >
      <Flex direction="column" gap={1} align="center">
        {/* Connection indicator */}
        <Flex align="center" gap={2}>
          <Box
            w="8px"
            h="8px"
            borderRadius="full"
            bg={
              isScanning ? "green.400" : isConnected ? "yellow.400" : "red.400"
            }
          />
          <Text fontSize="xs" color="whiteAlpha.800">
            {isScanning
              ? "Scanning..."
              : isConnected
                ? "Connected"
                : "Disconnected"}
          </Text>
        </Flex>

        {/* Stats */}
        <Flex gap={4}>
          <Text fontSize="xs" color="whiteAlpha.600">
            Frames: {framesSent}
          </Text>
          <Text fontSize="xs" color="whiteAlpha.600">
            Points: {totalPoints.toLocaleString()}
          </Text>
        </Flex>

        {/* Latency */}
        {latestFrame && (
          <Text fontSize="xs" color="whiteAlpha.500">
            {latestFrame.inferenceTimeMs.toFixed(0)}ms latency
          </Text>
        )}
      </Flex>
    </Box>
  );
}
