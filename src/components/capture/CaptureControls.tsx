import { Flex, Box, Button } from "@chakra-ui/react";

interface CaptureControlsProps {
  onCapture: () => void;
  onFinish: () => void;
  isComplete: boolean;
  canUndo: boolean;
  onUndo: () => void;
}

export function CaptureControls({
  onCapture,
  onFinish,
  isComplete,
  canUndo: _canUndo,
}: CaptureControlsProps) {
  return (
    <Flex direction="column" align="center" gap={4} pb={6} px={6}>
      {isComplete ? (
        <Button
          colorPalette="green"
          size="lg"
          w="100%"
          borderRadius="full"
          onClick={onFinish}
        >
          Finish
        </Button>
      ) : (
        <Box
          as="button"
          w="72px"
          h="72px"
          borderRadius="full"
          border="4px solid white"
          bg="transparent"
          cursor="pointer"
          onClick={onCapture}
          _hover={{ bg: "whiteAlpha.200" }}
          _active={{ transform: "scale(0.95)" }}
          transition="all 0.1s"
        >
          <Box w="100%" h="100%" borderRadius="full" bg="whiteAlpha.300" />
        </Box>
      )}
    </Flex>
  );
}
