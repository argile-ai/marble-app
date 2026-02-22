import { Box, Text } from "@chakra-ui/react";
import { MobileContainer } from "../components/layout/MobileContainer";
import { BottomTabBar } from "../components/layout/BottomTabBar";
import { ProfileHeader } from "../components/gallery/ProfileHeader";
import { AssetGrid } from "../components/gallery/AssetGrid";
import { useAssets } from "../stores/assetStore";

export function ProfilePage() {
  const { state } = useAssets();

  return (
    <MobileContainer bg="gray.50">
      <Box h="dvh" overflow="auto" pb="80px">
        <Text
          fontSize="lg"
          fontWeight="bold"
          textAlign="center"
          py={3}
          color="gray.800"
        >
          Profile
        </Text>
        <ProfileHeader />
        <Box px={4} pt={2}>
          <Text fontSize="md" fontWeight="semibold" color="gray.700" mb={3}>
            My assets
          </Text>
          <AssetGrid assets={state.assets} />
        </Box>
      </Box>
      <BottomTabBar />
    </MobileContainer>
  );
}
