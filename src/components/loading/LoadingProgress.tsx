import { Flex, Text } from "@chakra-ui/react";
import { ProgressBar } from "../ui/ProgressBar";

interface LoadingProgressProps {
  progress: number;
}

export function LoadingProgress({ progress }: LoadingProgressProps) {
  return (
    <Flex direction="column" align="center" gap={3} w="100%" maxW="280px">
      <Text color="white" fontSize="lg" fontWeight="semibold">
        Generating 3D World
      </Text>
      <ProgressBar value={progress} colorScheme="purple" />
      <Text color="whiteAlpha.600" fontSize="sm">
        {Math.round(progress)}%
      </Text>
    </Flex>
  );
}
