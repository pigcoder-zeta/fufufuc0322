import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import SceneImage from "./pages/SceneImage";
import SoraVideo from "./pages/SoraVideo";
import History from "./pages/History";
import Billing from "./pages/Billing";
import Callback from "./pages/Callback";
import { Toaster } from "react-hot-toast";

const App = () => {
  return (
    <div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1c2026",
            color: "#dfe2eb",
            border: "1px solid rgba(69,71,75,0.35)",
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
          },
          success: { iconTheme: { primary: "#b8c3ff", secondary: "#002388" } },
          error:   { iconTheme: { primary: "#ffb4ab", secondary: "#690005" } },
        }}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/ai" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="scene-image" element={<SceneImage />} />
          <Route path="sora-video" element={<SoraVideo />} />
          <Route path="history" element={<History />} />
          <Route path="billing" element={<Billing />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
