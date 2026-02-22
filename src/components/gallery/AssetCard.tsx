import { Box, Flex, Text, Image, Badge } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { Asset } from "../../types";
import { formatRelativeTime } from "../../utils/formatTime";

interface AssetCardProps {
  asset: Asset;
}

export function AssetCard({ asset }: AssetCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (asset.status === "complete") {
      navigate(`/viewer/${asset.id}`);
    }
  };

  return (
    <Box
      bg="white"
      borderRadius="xl"
      overflow="hidden"
      boxShadow="sm"
      cursor={asset.status === "complete" ? "pointer" : "default"}
      onClick={handleClick}
      transition="transform 0.2s"
      _hover={asset.status === "complete" ? { transform: "scale(1.02)" } : {}}
    >
      <Image
        src={asset.thumbnailUrl}
        alt={asset.title}
        w="100%"
        h="120px"
        objectFit="cover"
        bg="gray.100"

      />
      <Box p={3}>
        <Text fontSize="sm" fontWeight="semibold" color="gray.800" truncate>
          {asset.title}
        </Text>
        <Flex justify="space-between" align="center" mt={1}>
          <Badge
            colorPalette={asset.status === "complete" ? "green" : "yellow"}
            size="sm"
          >
            {asset.status === "complete" ? "Complete" : "Processing"}
          </Badge>
          <Text fontSize="xs" color="gray.400">
            {formatRelativeTime(asset.createdAt)}
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}
