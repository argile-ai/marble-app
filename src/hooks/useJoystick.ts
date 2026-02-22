import { useEffect, useRef, useState, useCallback } from "react";
import nipplejs from "nipplejs";
import type { JoystickData } from "../types";

export function useJoystick() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [joystickData, setJoystickData] = useState<JoystickData>({
    x: 0,
    y: 0,
    active: false,
  });

  const initJoystick = useCallback(() => {
    if (!containerRef.current) return;

    const manager = nipplejs.create({
      zone: containerRef.current,
      mode: "static",
      position: { left: "50%", bottom: "20px" },
      color: "rgba(255,255,255,0.5)",
      size: 120,
    });

    manager.on("move", (_, data) => {
      const force = Math.min(data.force, 2) / 2;
      const angle = data.angle.radian;
      setJoystickData({
        x: Math.cos(angle) * force,
        y: Math.sin(angle) * force,
        active: true,
      });
    });

    manager.on("end", () => {
      setJoystickData({ x: 0, y: 0, active: false });
    });

    return () => manager.destroy();
  }, []);

  useEffect(() => {
    return initJoystick();
  }, [initJoystick]);

  return { containerRef, joystickData };
}
