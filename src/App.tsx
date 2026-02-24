import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AssetProvider } from "./stores/assetStore";
import { ScanProvider } from "./stores/scanStore";
import { ProfilePage } from "./pages/ProfilePage";
import { CapturePage } from "./pages/CapturePage";
import { GeneratingPage } from "./pages/GeneratingPage";
import { ViewerPage } from "./pages/ViewerPage";

export default function App() {
  return (
    <AssetProvider>
      <ScanProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="/generating" element={<GeneratingPage />} />
            <Route path="/viewer/:assetId" element={<ViewerPage />} />
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Routes>
        </BrowserRouter>
      </ScanProvider>
    </AssetProvider>
  );
}
