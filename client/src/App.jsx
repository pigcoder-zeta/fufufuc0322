import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import SceneImage from "./pages/SceneImage";
import SoraVideo from "./pages/SoraVideo";
import Billing from "./pages/Billing";
import Callback from "./pages/Callback";
import { Toaster } from "react-hot-toast";

const App = () => {
  return (
    <div>
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/ai" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="scene-image" element={<SceneImage />} />
          <Route path="sora-video" element={<SoraVideo />} />
          <Route path="billing" element={<Billing />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
