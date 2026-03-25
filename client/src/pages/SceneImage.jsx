import { useState, useEffect, useRef, useCallback } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";

const SIZES = [
  { value: "1024x1024", label: "1:1",  sub: "Square" },
  { value: "768x1024",  label: "3:4",  sub: "Portrait" },
  { value: "1024x768",  label: "4:3",  sub: "Landscape" },
  { value: "1280x720",  label: "16:9", sub: "Cinematic" },
];

const StatusBadge = ({ status }) => {
  const map = {
    completed: { color: "#b8c3ff", label: "COMPLETE" },
    running:   { color: "#e9c349", label: "PROCESSING", pulse: true },
    pending:   { color: "#c2c7d0", label: "QUEUED", pulse: true },
    failed:    { color: "#ffb4ab", label: "FAILED" },
  };
  const cfg = map[status] || map.completed;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
      style={{ background: "rgba(16,20,26,0.85)", backdropFilter: "blur(12px)", color: cfg.color }}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? "animate-pulse" : ""}`}
        style={{ background: cfg.color }} />
      {cfg.label}
    </div>
  );
};

const SceneImage = () => {
  const authAxios = useAuthAxios();

  const [scenes,         setScenes]         = useState([]);
  const [selectedScene,  setSelectedScene]  = useState(null);
  const [prompt,         setPrompt]         = useState("");
  const [size,           setSize]           = useState("1024x1024");
  const [estimatedPts,   setEstimatedPts]   = useState(null);
  const [generating,     setGenerating]     = useState(false);
  const [result,         setResult]         = useState(null);
  const debounceRef = useRef(null);

  // Load scenes
  useEffect(() => {
    authAxios.get("/api/ai/scenes")
      .then(r => {
        const imgs = (r.data?.data || []).filter(s => s.output_type === "image");
        setScenes(imgs);
        if (imgs.length > 0) setSelectedScene(imgs[0]);
      })
      .catch(console.error);
  }, []);

  // Debounced estimate
  const estimate = useCallback(() => {
    if (!selectedScene) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await authAxios.post("/api/ai/estimate-points", {
          scene_key: selectedScene.scene_key,
          output_type: "image",
          size,
        });
        setEstimatedPts(data?.data?.estimated_points ?? null);
      } catch (_) {}
    }, 400);
  }, [selectedScene, size, authAxios]);

  useEffect(() => { estimate(); }, [estimate]);

  const handleGenerate = async () => {
    if (!selectedScene || !prompt.trim()) {
      toast.error("Please select a scene and enter a prompt");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const { data } = await authAxios.post("/api/ai/generate-scene-image", {
        scene_key: selectedScene.scene_key,
        user_prompt: prompt,
        model: selectedScene.default_model,
        size,
      });
      setResult(data);
      if (data.status === "completed") toast.success("Image generated!");
      else toast.error(data.message || "Generation failed");
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === "INSUFFICIENT_POINTS") {
        toast.error(`Insufficient points — need ${errData.required_points}, have ${errData.available_points}`);
      } else {
        toast.error(errData?.message || "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.creation_id) return;
    try {
      const { data } = await authAxios.get(`/api/user/creations/${result.creation_id}/download`);
      if (data?.data?.download_url) {
        const a = document.createElement("a");
        a.href = data.data.download_url;
        a.download = `image_${result.creation_id}.jpg`;
        a.click();
      }
    } catch { toast.error("Download failed"); }
  };

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h2 className="text-4xl font-extrabold mb-2"
          style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em" }}>
          AI Image Generation
        </h2>
        <p className="text-lg max-w-2xl" style={{ color: "#c2c7d0", opacity: 0.7 }}>
          Architect high-fidelity visuals using neural synthesis. Define your parameters and generate.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* ── Left: Config ── */}
        <section className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-6 sticky top-24">
          {/* Scene selector */}
          <div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-3"
              style={{ color: "#b8c3ff" }}>
              <span className="material-symbols-outlined text-sm">layers</span>
              Scene Template
            </label>
            <div className="space-y-2">
              {scenes.map(s => (
                <div key={s.scene_key}
                  onClick={() => setSelectedScene(s)}
                  className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: selectedScene?.scene_key === s.scene_key ? "#1c2026" : "#181c22",
                    border: `1px solid ${selectedScene?.scene_key === s.scene_key ? "rgba(184,195,255,0.35)" : "rgba(69,71,75,0.15)"}`,
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm"
                      style={{ color: selectedScene?.scene_key === s.scene_key ? "#b8c3ff" : "#8f9095" }}>
                      architecture
                    </span>
                    <span className="text-sm font-semibold"
                      style={{ color: selectedScene?.scene_key === s.scene_key ? "#dfe2eb" : "#c2c7d0" }}>
                      {s.scene_name}
                    </span>
                  </div>
                  {selectedScene?.scene_key === s.scene_key && (
                    <span className="material-symbols-outlined filled text-lg" style={{ color: "#b8c3ff" }}>check_circle</span>
                  )}
                </div>
              ))}
              {scenes.length === 0 && (
                <div className="text-center py-6 rounded-xl" style={{ background: "#181c22" }}>
                  <div className="w-5 h-5 rounded-full border-2 border-[#b8c3ff] border-t-transparent animate-spin mx-auto mb-2" />
                  <p className="text-xs" style={{ color: "#8f9095" }}>Loading scenes…</p>
                </div>
              )}
            </div>
          </div>

          {/* Size selector */}
          <div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-3"
              style={{ color: "#b8c3ff" }}>
              <span className="material-symbols-outlined text-sm">aspect_ratio</span>
              Output Size
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SIZES.map(s => (
                <button key={s.value} onClick={() => setSize(s.value)}
                  className="p-3 rounded-xl flex flex-col items-center gap-1 transition-all"
                  style={{
                    background: size === s.value ? "#1c2026" : "#181c22",
                    border: `1px solid ${size === s.value ? "rgba(184,195,255,0.4)" : "rgba(69,71,75,0.15)"}`,
                    color: size === s.value ? "#b8c3ff" : "#8f9095",
                  }}>
                  <span className="text-xs font-bold">{s.label}</span>
                  <span className="text-[9px] opacity-60">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cost estimate */}
          {estimatedPts !== null && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "#0a0e14" }}>
              <span className="material-symbols-outlined text-sm" style={{ color: "#b8c3ff" }}>bolt</span>
              <div>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#8f9095" }}>Estimated Cost</p>
                <p className="text-base font-bold" style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
                  ~{estimatedPts} pts
                </p>
              </div>
            </div>
          )}

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={generating || !selectedScene}
            className="w-full py-4 rounded-xl font-extrabold tracking-tight flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)",
              color: "#002388",
              fontFamily: "Manrope, sans-serif",
              boxShadow: "0 8px 32px rgba(184,195,255,0.12)",
            }}>
            {generating
              ? <><span className="w-4 h-4 rounded-full border-2 border-[#002388] border-t-transparent animate-spin" />Processing…</>
              : <><span className="material-symbols-outlined">bolt</span>GENERATE IMAGE</>
            }
          </button>
        </section>

        {/* ── Right: Prompt + Result ── */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Prompt area */}
          <div className="rounded-2xl p-6" style={{ background: "#181c22" }}>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-4"
              style={{ color: "#b8c3ff" }}>
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Creative Direction
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your product scene in detail…
e.g. 白色陶瓷马克杯，旁边放半块柠檬，背景干净清爽"
              rows={5}
              className="w-full resize-none text-sm outline-none transition-all rounded-xl p-4"
              style={{
                background: "#0a0e14",
                color: "#dfe2eb",
                border: "1px solid rgba(69,71,75,0.25)",
                fontFamily: "Inter, sans-serif",
                lineHeight: 1.7,
              }}
              onFocus={e => e.target.style.border = "1px solid rgba(184,195,255,0.5)"}
              onBlur={e => e.target.style.border = "1px solid rgba(69,71,75,0.25)"}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-[10px]" style={{ color: "#8f9095" }}>
                System prompt from scene template will be prepended automatically.
              </p>
              <span className="text-[10px]" style={{ color: "#8f9095" }}>{prompt.length} chars</span>
            </div>
          </div>

          {/* Result area */}
          {generating ? (
            <div className="rounded-2xl p-16 flex flex-col items-center justify-center"
              style={{ background: "#181c22", border: "1px solid rgba(69,71,75,0.12)" }}>
              {/* Gold pulse loader */}
              <div className="w-16 h-16 rounded-full animate-gold-pulse mb-6"
                style={{ border: "2px solid #e9c349" }} />
              <p className="font-bold mb-1" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                Neural Synthesis in Progress
              </p>
              <p className="text-sm" style={{ color: "#8f9095" }}>
                The digital architect is constructing your vision…
              </p>
            </div>
          ) : result?.status === "completed" && result?.content ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#181c22" }}>
              <div className="relative">
                <img src={result.content} alt="Generated" className="w-full object-cover" style={{ maxHeight: 520 }} />
                <div className="absolute top-4 right-4">
                  <StatusBadge status="completed" />
                </div>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <p className="font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                    {selectedScene?.scene_name}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#8f9095" }}>
                    {result.points_charged} pts • Expires {new Date(result.expires_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <button onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)",
                    color: "#002388",
                    fontFamily: "Manrope, sans-serif",
                  }}>
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download Without Watermark
                </button>
              </div>
            </div>
          ) : result?.status === "failed" ? (
            <div className="rounded-2xl p-12 flex flex-col items-center text-center" style={{ background: "#181c22" }}>
              <span className="material-symbols-outlined text-4xl mb-4" style={{ color: "#ffb4ab" }}>error_outline</span>
              <p className="font-bold mb-2" style={{ color: "#ffb4ab", fontFamily: "Manrope, sans-serif" }}>Generation Failed</p>
              <p className="text-sm" style={{ color: "#8f9095" }}>Points have been returned to your account.</p>
            </div>
          ) : (
            <div className="rounded-2xl p-16 flex flex-col items-center justify-center"
              style={{ background: "#181c22", border: "2px dashed rgba(69,71,75,0.25)" }}>
              <span className="material-symbols-outlined text-5xl mb-4" style={{ color: "#45474b" }}>auto_awesome</span>
              <p className="font-bold mb-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                Your canvas awaits
              </p>
              <p className="text-sm" style={{ color: "#8f9095" }}>
                Select a scene, enter your prompt, and click Generate
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SceneImage;
