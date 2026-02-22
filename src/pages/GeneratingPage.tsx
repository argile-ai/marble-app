import { useEffect, useState, useRef } from "react";
import { Flex } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { MobileContainer } from "../components/layout/MobileContainer";
import { GeneratingGlobe } from "../components/loading/GeneratingGlobe";
import { LoadingProgress } from "../components/loading/LoadingProgress";
import { useAssets } from "../stores/assetStore";
import { GENERATION_DURATION_MS } from "../utils/constants";

export function GeneratingPage() {
  const navigate = useNavigate();
  const { dispatch } = useAssets();
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / GENERATION_DURATION_MS) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        const newId = crypto.randomUUID();
        dispatch({
          type: "ADD_ASSET",
          payload: {
            id: newId,
            title: "New Scene",
            status: "complete",
            thumbnailUrl: "/assets/scene-thumbnail.jpg",
            createdAt: new Date(),
          },
        });
        navigate(`/viewer/${newId}`);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [dispatch, navigate]);

  return (
    <MobileContainer bg="gray.900">
      <Flex
        direction="column"
        align="center"
        justify="center"
        h="dvh"
        gap={8}
      >
        <GeneratingGlobe />
        <LoadingProgress progress={progress} />
      </Flex>
    </MobileContainer>
  );
}
