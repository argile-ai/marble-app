import { Box } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";

interface ViewerControlsProps {
  onBack: () => void;
}

export function ViewerControls({ onBack }: ViewerControlsProps) {
  return (
    <Box
      as="button"
      position="absolute"
      top={4}
      left={4}
      w="40px"
      h="40px"
      borderRadius="full"
      bg="blackAlpha.500"
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      onClick={onBack}
      zIndex={10}
      _hover={{ bg: "blackAlpha.700" }}
    >
      <ArrowLeft size={20} color="white" />
    </Box>
  );
}
