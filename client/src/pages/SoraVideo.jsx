import { useState, useEffect, useRef, useCallback } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";

const DURATIONS = [4, 6, 8, 10, 12];
const SIZES     = [
  { value: "720x1280",  label: "9:16",  sub: "Short Video" },
  { value: "1280x720",  label: "16:9",  sub: "Landscape" },
  { value: "1024x1024", label: "1:1",   sub: "Square" },
];

const STATUS_MAP = {
  pending:   { label: "QUEUED",      color: "#c2c7d0", pulse: true },
  running:   { label: "PROCESSING",  color: "#e9c349", pulse: true },
  completed: { label: "COMPLETE",    color: "#b8c3ff" },
  failed:    { label: "FAILED",      color: "#ffb4ab" },
};

const ProgressBar = ({ value }) => (
  <div className="w-full h-1.5 rounded-full" style={{ background: "#0a0e14" }}>
    <div className="h-full rounded-full transition-all duration-700"
      style={{ width: `${value}%`, background: "linear-gradient(90deg, #b8c3ff 0%, #4d70ff 100%)" }} />
  </div>
);

const SoraVideo = () => {
  const authAxios = useAuthAxios();

  const [scenes,        setScenes]        = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [prompt,        setPrompt]        = useState("");
  const [seconds,       setSeconds]       = useState(8);
  const [size,          setSize]          = useState("720x1280");
  const [estimatedPts,  setEstimatedPts]  = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [creationId,    setCreationId]    = useState(null);
  const [pollData,      setPollData]      = useState(null);
  const pollRef  = useRef(null);
  const debRef   = useRef(null);

  // Load scenes
  useEffect(() => {
    authAxios.get("/api/ai/scenes")
      .then(r => {
        const vids = (r.data?.data || []).filter(s => s.output_type === "video");
        setScenes(vids);
        if (vids.length > 0) setSelectedScene(vids[0]);
      })
      .catch(console.error);
    return () => { clearInterval(pollRef.current); };
  }, []);

  // Estimate points (debounced)
  const estimate = useCallback(() => {
    if (!selectedScene) return;
    clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const { data } = await authAxios.post("/api/ai/estimate-points", {
          scene_key: selectedScene.scene_key,
          output_type: "video",
          model: selectedScene.default_model,
          seconds,
          size,
        });
        setEstimatedPts(data?.data?.estimated_points ?? null);
      } catch (_) {}
    }, 400);
  }, [selectedScene, seconds, size, authAxios]);

  useEffect(() => { estimate(); }, [estimate]);

  // Poll video status
  const startPoll = useCallback((id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await authAxios.get(`/api/ai/video-status/${id}`);
        setPollData(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(pollRef.current);
          if (data.status === "completed") toast.success("Video ready!");
          else toast.error(data.error_message || "Video generation failed");
        }
      } catch (_) {}
    }, 4000);
  }, [authAxios]);

  const handleSubmit = async () => {
    if (!selectedScene || !prompt.trim()) {
      toast.error("Please select a scene and enter a prompt");
      return;
    }
    setSubmitting(true);
    setPollData(null);
    setCreationId(null);
    try {
      const { data } = await authAxios.post("/api/ai/generate-sora-video", {
        scene_key: selectedScene.scene_key,
        user_prompt: prompt,
        model: selectedScene.default_model,
        seconds,
        size,
      });
      if (data?.success) {
        setCreationId(data.creation_id);
        setPollData(data);
        toast("Video task submitted — polling for updates…", { icon: "⏳" });
        startPoll(data.creation_id);
      } else {
        toast.error(data?.message || "Submission failed");
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === "INSUFFICIENT_POINTS") {
        toast.error(`Insufficient points — need ${errData.required_points}, have ${errData.available_points}`);
      } else {
        toast.error(errData?.message || "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!creationId) return;
    try {
      const { data } = await authAxios.get(`/api/user/creations/${creationId}/download`);
      if (data?.data?.download_url) {
        const a = document.createElement("a");
        a.href = data.data.download_url;
        a.download = `video_${creationId}.mp4`;
        a.click();
      }
    } catch { toast.error("Download failed"); }
  };

  const cfg     = pollData ? STATUS_MAP[pollData.status] : null;
  const isDone  = pollData?.status === "completed";
  const isFailed = pollData?.status === "failed";

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h2 className="text-4xl font-extrabold mb-2"
          style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em" }}>
          AI Video Generation
        </h2>
        <p className="text-lg max-w-2xl" style={{ color: "#c2c7d0", opacity: 0.7 }}>
          Cinematic Sora-2 motion synthesis for e-commerce promotions and product showcase videos.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* ── Left: Config ── */}
        <section className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-6 sticky top-24">
          {/* Scene */}
          <div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-3"
              style={{ color: "#e9c349" }}>
              <span className="material-symbols-outlined text-sm">movie_filter</span>
              Scene Template
            </label>
            <div className="space-y-2">
              {scenes.map(s => (
                <div key={s.scene_key} onClick={() => setSelectedScene(s)}
                  className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: selectedScene?.scene_key === s.scene_key ? "#1c2026" : "#181c22",
                    border: `1px solid ${selectedScene?.scene_key === s.scene_key ? "rgba(233,195,73,0.35)" : "rgba(69,71,75,0.15)"}`,
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm"
                      style={{ color: selectedScene?.scene_key === s.scene_key ? "#e9c349" : "#8f9095" }}>
                      movie
                    </span>
                    <span className="text-sm font-semibold"
                      style={{ color: selectedScene?.scene_key === s.scene_key ? "#dfe2eb" : "#c2c7d0" }}>
                      {s.scene_name}
                    </span>
                  </div>
                  {selectedScene?.scene_key === s.scene_key && (
                    <span className="material-symbols-outlined filled text-lg" style={{ color: "#e9c349" }}>check_circle</span>
                  )}
                </div>
              ))}
              {scenes.length === 0 && (
                <div className="text-center py-6 rounded-xl" style={{ background: "#181c22" }}>
                  <div className="w-5 h-5 rounded-full border-2 border-[#e9c349] border-t-transparent animate-spin mx-auto mb-2" />
                  <p className="text-xs" style={{ color: "#8f9095" }}>Loading scenes…</p>
                </div>
              )}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-3"
              style={{ color: "#e9c349" }}>
              <span className="material-symbols-outlined text-sm">timer</span>
              Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setSeconds(d)}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: seconds === d ? "#1c2026" : "#181c22",
                    border: `1px solid ${seconds === d ? "rgba(233,195,73,0.4)" : "rgba(69,71,75,0.15)"}`,
                    color: seconds === d ? "#e9c349" : "#8f9095",
                  }}>
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-3"
              style={{ color: "#e9c349" }}>
              <span className="material-symbols-outlined text-sm">aspect_ratio</span>
              Video Format
            </label>
            <div className="space-y-2">
              {SIZES.map(s => (
                <button key={s.value} onClick={() => setSize(s.value)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={{
                    background: size === s.value ? "#1c2026" : "#181c22",
                    border: `1px solid ${size === s.value ? "rgba(233,195,73,0.4)" : "rgba(69,71,75,0.15)"}`,
                    color: size === s.value ? "#e9c349" : "#8f9095",
                  }}>
                  <span className="text-xs font-bold">{s.label}</span>
                  <span className="text-[10px] opacity-60">{s.sub}</span>
                  <span className="ml-auto text-[10px] opacity-50">{s.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Estimate */}
          {estimatedPts !== null && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "#0a0e14" }}>
              <span className="material-symbols-outlined text-sm" style={{ color: "#e9c349" }}>bolt</span>
              <div>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#8f9095" }}>Estimated Cost</p>
                <p className="text-base font-bold" style={{ color: "#e9c349", fontFamily: "Manrope, sans-serif" }}>
                  ~{estimatedPts} pts
                </p>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button onClick={handleSubmit} disabled={submitting || !selectedScene || !!creationId && !isDone && !isFailed}
            className="w-full py-4 rounded-xl font-extrabold tracking-tight flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#262a31",
              color: "#e9c349",
              border: "1px solid rgba(233,195,73,0.35)",
              fontFamily: "Manrope, sans-serif",
            }}>
            {submitting
              ? <><span className="w-4 h-4 rounded-full border-2 border-[#e9c349] border-t-transparent animate-spin" />Submitting…</>
              : <><span className="material-symbols-outlined">videocam</span>GENERATE VIDEO</>
            }
          </button>
        </section>

        {/* ── Right: Prompt + Result ── */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Prompt */}
          <div className="rounded-2xl p-6" style={{ background: "#181c22" }}>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-4"
              style={{ color: "#e9c349" }}>
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Motion Direction
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the cinematic motion and scene…
e.g. 镜头缓缓环绕马克杯，展示材质与蒸汽感，背景是黑色大理石桌面"
              rows={5}
              className="w-full resize-none text-sm outline-none transition-all rounded-xl p-4"
              style={{
                background: "#0a0e14",
                color: "#dfe2eb",
                border: "1px solid rgba(69,71,75,0.25)",
                fontFamily: "Inter, sans-serif",
                lineHeight: 1.7,
              }}
              onFocus={e => e.target.style.border = "1px solid rgba(233,195,73,0.45)"}
              onBlur={e => e.target.style.border = "1px solid rgba(69,71,75,0.25)"}
            />
            <div className="flex justify-between mt-2">
              <p className="text-[10px]" style={{ color: "#8f9095" }}>
                Video generation is async — poll results after submitting.
              </p>
              <span className="text-[10px]" style={{ color: "#8f9095" }}>{prompt.length} chars</span>
            </div>
          </div>

          {/* Task status panel */}
          {pollData ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#181c22" }}>
              {/* Status header */}
              <div className="p-6" style={{ borderBottom: "1px solid rgba(69,71,75,0.15)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#8f9095" }}>
                      Creation #{creationId}
                    </p>
                    <p className="font-bold text-lg" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                      {selectedScene?.scene_name}
                    </p>
                  </div>
                  {cfg && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                      style={{ background: "rgba(16,20,26,0.85)", backdropFilter: "blur(12px)", color: cfg.color }}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? "animate-pulse" : ""}`}
                        style={{ background: cfg.color }} />
                      {cfg.label}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <ProgressBar value={pollData.progress ?? 0} />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px]" style={{ color: "#8f9095" }}>
                    {pollData.provider_status || "Initializing"}
                  </span>
                  <span className="text-[10px]" style={{ color: "#8f9095" }}>
                    {pollData.progress ?? 0}%
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x p-0"
                style={{ borderBottom: "1px solid rgba(69,71,75,0.15)" }}>
                {[
                  { label: "Reserved",  value: `${pollData.points_reserved ?? 0} pts` },
                  { label: "Charged",   value: `${pollData.points_charged  ?? 0} pts` },
                  { label: "Duration",  value: `${seconds}s / ${size}` },
                ].map(({ label, value }, i) => (
                  <div key={label} className="p-4 text-center"
                    style={{ borderColor: "rgba(69,71,75,0.15)" }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#8f9095" }}>{label}</p>
                    <p className="text-sm font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Video preview / actions */}
              {isDone && pollData.content ? (
                <div className="p-6 space-y-4">
                  <video controls className="w-full rounded-xl"
                    style={{ maxHeight: 400, background: "#0a0e14" }}>
                    <source src={pollData.content} />
                    Your browser does not support video playback.
                  </video>
                  <div className="flex gap-3">
                    <button onClick={handleDownload}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                      style={{
                        background: "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)",
                        color: "#002388",
                        fontFamily: "Manrope, sans-serif",
                      }}>
                      <span className="material-symbols-outlined text-sm">download</span>
                      Download Without Watermark
                    </button>
                    <button onClick={() => { setCreationId(null); setPollData(null); setPrompt(""); }}
                      className="px-5 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80"
                      style={{ background: "#262a31", color: "#c2c7d0", fontFamily: "Manrope, sans-serif" }}>
                      New Video
                    </button>
                  </div>
                </div>
              ) : isFailed ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: "#ffb4ab" }}>error_outline</span>
                  <p className="font-bold mb-1" style={{ color: "#ffb4ab", fontFamily: "Manrope, sans-serif" }}>Generation Failed</p>
                  <p className="text-sm mb-4" style={{ color: "#8f9095" }}>
                    {pollData.error_message || "Points have been returned to your account."}
                  </p>
                  <button onClick={() => { setCreationId(null); setPollData(null); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: "#262a31", color: "#c2c7d0", fontFamily: "Manrope, sans-serif" }}>
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full border-2 animate-gold-pulse mx-auto mb-4"
                    style={{ borderColor: "#e9c349" }} />
                  <p className="font-bold mb-1" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                    Video Being Generated
                  </p>
                  <p className="text-sm" style={{ color: "#8f9095" }}>
                    Polling every 4 seconds. This may take a few minutes for Sora-2.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl p-16 flex flex-col items-center justify-center"
              style={{ background: "#181c22", border: "2px dashed rgba(69,71,75,0.25)" }}>
              <span className="material-symbols-outlined text-5xl mb-4" style={{ color: "#45474b" }}>movie_filter</span>
              <p className="font-bold mb-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                Your cinematic canvas awaits
              </p>
              <p className="text-sm" style={{ color: "#8f9095" }}>
                Select a scene, enter motion direction, configure timing, then submit
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SoraVideo;
