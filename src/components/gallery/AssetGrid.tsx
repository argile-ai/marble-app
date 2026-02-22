import { SimpleGrid, Text, Box } from "@chakra-ui/react";
import type { Asset } from "../../types";
import { AssetCard } from "./AssetCard";

interface AssetGridProps {
  assets: Asset[];
}

export function AssetGrid({ assets }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <Box py={12} textAlign="center">
        <Text color="gray.400" fontSize="sm">
          No assets yet. Capture your first scene!
        </Text>
      </Box>
    );
  }

  return (
    <SimpleGrid columns={2} gap={3}>
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </SimpleGrid>
  );
}
