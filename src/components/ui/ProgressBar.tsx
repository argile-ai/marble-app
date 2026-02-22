import { Box } from "@chakra-ui/react";

interface ProgressBarProps {
  value: number; // 0-100
  colorScheme?: string;
}

export function ProgressBar({ value, colorScheme = "green" }: ProgressBarProps) {
  const colors: Record<string, string> = {
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
  };
  const color = colors[colorScheme] ?? colors.green;

  return (
    <Box w="100%" h="4px" bg="whiteAlpha.200" borderRadius="full" overflow="hidden">
      <Box
        h="100%"
        w={`${Math.min(value, 100)}%`}
        bg={color}
        borderRadius="full"
        transition="width 0.3s ease"
      />
    </Box>
  );
}
