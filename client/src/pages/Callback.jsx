import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthing } from "../contexts/AuthingContext";

const Callback = () => {
  const navigate               = useNavigate();
  const { isReady, isSignedIn } = useAuthing();

  useEffect(() => {
    if (isReady) {
      navigate(isSignedIn ? "/ai" : "/", { replace: true });
    }
  }, [isReady, isSignedIn, navigate]);

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#10141a" }}>
      <div className="flex flex-col items-center gap-6">
        {/* VisionAI brand mark */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "#b8c3ff" }}>
          <span className="material-symbols-outlined filled text-xl" style={{ color: "#002388" }}>
            architecture
          </span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold mb-1"
            style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
            VisionAI
          </h1>
          <p className="text-sm" style={{ color: "#8f9095" }}>Completing authentication…</p>
        </div>
        {/* Spinner */}
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#b8c3ff", borderTopColor: "transparent" }} />
      </div>
    </div>
  );
};

export default Callback;
