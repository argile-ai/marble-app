import { Box } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { MobileContainer } from "../components/layout/MobileContainer";
import { SceneCanvas } from "../components/viewer/SceneCanvas";
import { ViewerControls } from "../components/viewer/ViewerControls";
import { VirtualJoystick } from "../components/viewer/VirtualJoystick";
import { useJoystick } from "../hooks/useJoystick";

export function ViewerPage() {
  const navigate = useNavigate();
  const { containerRef, joystickData } = useJoystick();

  return (
    <MobileContainer bg="black">
      <Box position="relative" h="dvh">
        <SceneCanvas joystickData={joystickData} />
        <ViewerControls onBack={() => navigate("/profile")} />
        <VirtualJoystick containerRef={containerRef} />
      </Box>
    </MobileContainer>
  );
}
