import { Flex, Text, Image, Box } from "@chakra-ui/react";

export function ProfileHeader() {
  return (
    <Flex direction="column" align="center" pt={8} pb={4} gap={3}>
      <Image
        src="/assets/avatar-placeholder.png"
        alt="User avatar"
        w="80px"
        h="80px"
        borderRadius="full"
        objectFit="cover"
        bg="gray.200"
      />
      <Box textAlign="center">
        <Text fontSize="lg" fontWeight="bold" color="gray.800">
          Demo User
        </Text>
        <Text fontSize="sm" color="gray.500">
          demo@example.com
        </Text>
      </Box>
    </Flex>
  );
}
