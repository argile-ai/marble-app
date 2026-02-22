import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface MobileContainerProps {
  children: ReactNode;
  bg?: string;
}

export function MobileContainer({ children, bg = "gray.50" }: MobileContainerProps) {
  return (
    <Box
      maxW="md"
      mx="auto"
      minH="dvh"
      bg={bg}
      position="relative"
      overflow="hidden"
    >
      {children}
    </Box>
  );
}
