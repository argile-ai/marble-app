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
      bg="whiteAlpha.100"
      borderRadius="xl"
      px={4}
      py={2}
      mx="auto"
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
              isScanning && isConnected
                ? "green.400"
                : isScanning
                  ? "yellow.400"
                  : isConnected
                    ? "green.400"
                    : "red.400"
            }
          />
          <Text fontSize="xs" color="whiteAlpha.800">
            {isScanning && isConnected
              ? "Scanning"
              : isScanning
                ? "Scanning (connecting...)"
                : isConnected
                  ? "Connected"
                  : "Offline"}
          </Text>
        </Flex>

        {/* Error */}
        {scanState.error && (
          <Text fontSize="xs" color="orange.300">
            {scanState.error}
          </Text>
        )}

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
