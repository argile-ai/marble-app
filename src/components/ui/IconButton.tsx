import { IconButton as ChakraIconButton } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  label: string;
  variant?: "ghost" | "solid" | "outline";
  colorScheme?: string;
  size?: "sm" | "md" | "lg";
}

export function IconButton({
  icon,
  onClick,
  label,
  variant = "ghost",
  size = "md",
}: IconButtonProps) {
  return (
    <ChakraIconButton
      aria-label={label}
      onClick={onClick}
      variant={variant}
      size={size}
      borderRadius="full"
      color="white"
    >
      {icon}
    </ChakraIconButton>
  );
}
