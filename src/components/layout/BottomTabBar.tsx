import { Flex, Text, Box } from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Compass, Camera, User } from "lucide-react";

const tabs = [
  { label: "Explore", icon: Compass, path: "/explore" },
  { label: "Capture", icon: Camera, path: "/capture" },
  { label: "Profile", icon: User, path: "/profile" },
] as const;

export function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Flex
      position="fixed"
      bottom={0}
      left="50%"
      transform="translateX(-50%)"
      w="100%"
      maxW="md"
      bg="white"
      borderTop="1px solid"
      borderColor="gray.200"
      px={4}
      py={2}
      pb="env(safe-area-inset-bottom, 8px)"
      zIndex={50}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <Box
            key={tab.path}
            flex={1}
            cursor="pointer"
            onClick={() => navigate(tab.path)}
          >
            <Flex direction="column" align="center" gap={0.5}>
              <tab.icon
                size={22}
                color={isActive ? "#3b82f6" : "#9ca3af"}
              />
              <Text
                fontSize="xs"
                fontWeight={isActive ? "semibold" : "normal"}
                color={isActive ? "blue.500" : "gray.400"}
              >
                {tab.label}
              </Text>
            </Flex>
          </Box>
        );
      })}
    </Flex>
  );
}
