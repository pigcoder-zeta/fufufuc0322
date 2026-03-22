import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthingProvider } from "./contexts/AuthingContext.jsx";

createRoot(document.getElementById("root")).render(
  <AuthingProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AuthingProvider>
);
