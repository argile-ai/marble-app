import { Flex, Text } from "@chakra-ui/react";
import { ProgressBar } from "../ui/ProgressBar";

interface CaptureProgressProps {
  progress: number;
  total: number;
}

export function CaptureProgress({ progress, total }: CaptureProgressProps) {
  return (
    <Flex direction="column" gap={1} px={6} py={3}>
      <Text fontSize="sm" color="whiteAlpha.800" textAlign="center">
        {progress} of {total}
      </Text>
      <ProgressBar value={(progress / total) * 100} colorScheme="green" />
    </Flex>
  );
}
