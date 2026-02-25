import { Box, Flex, Text, Button } from "@chakra-ui/react";
import { X, Download } from "lucide-react";

interface FloorPlanModalProps {
  svg: string;
  numWalls: number;
  numDoors: number;
  numWindows: number;
  numObjects: number;
  inferenceTimeMs: number;
  onClose: () => void;
}

export function FloorPlanModal({
  svg,
  numWalls,
  numDoors,
  numWindows,
  numObjects,
  inferenceTimeMs,
  onClose,
}: FloorPlanModalProps) {
  const handleDownload = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floorplan-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Flex
      position="fixed"
      inset={0}
      zIndex={100}
      bg="blackAlpha.800"
      align="center"
      justify="center"
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius="xl"
        maxW="95vw"
        maxH="90vh"
        overflow="auto"
        p={4}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex justify="space-between" align="center" mb={3}>
          <Text fontWeight="bold" fontSize="lg" color="gray.800">
            Floor Plan
          </Text>
          <Flex gap={2}>
            <Button size="sm" onClick={handleDownload}>
              <Download size={16} />
              <Text ml={1}>SVG</Text>
            </Button>
            <Box
              as="button"
              p={1}
              borderRadius="full"
              cursor="pointer"
              onClick={onClose}
              _hover={{ bg: "gray.100" }}
            >
              <X size={20} color="#666" />
            </Box>
          </Flex>
        </Flex>

        {/* SVG display */}
        <Box
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          overflow="hidden"
          dangerouslySetInnerHTML={{ __html: svg }}
          css={{
            "& svg": {
              width: "100%",
              height: "auto",
              maxHeight: "65vh",
            },
          }}
        />

        {/* Stats */}
        <Flex gap={4} mt={3} flexWrap="wrap" justify="center">
          {numWalls > 0 && (
            <Text fontSize="xs" color="gray.500">
              {numWalls} walls
            </Text>
          )}
          {numDoors > 0 && (
            <Text fontSize="xs" color="gray.500">
              {numDoors} doors
            </Text>
          )}
          {numWindows > 0 && (
            <Text fontSize="xs" color="gray.500">
              {numWindows} windows
            </Text>
          )}
          {numObjects > 0 && (
            <Text fontSize="xs" color="gray.500">
              {numObjects} objects
            </Text>
          )}
          <Text fontSize="xs" color="gray.400">
            {(inferenceTimeMs / 1000).toFixed(1)}s
          </Text>
        </Flex>
      </Box>
    </Flex>
  );
}
