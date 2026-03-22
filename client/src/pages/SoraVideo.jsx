import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";
import { Download, Loader2, Sparkles, Video } from "lucide-react";

const SIZE_OPTIONS = [
  { value: "720x1280", label: "720×1280（竖版 9:16）" },
  { value: "1280x720", label: "1280×720（横版 16:9）" },
  { value: "1080x1080", label: "1080×1080（方版 1:1）" },
];

const DURATION_OPTIONS = [5, 8, 10];

const SoraVideo = () => {
  const axios = useAuthAxios();

  const [scenes, setScenes] = useState([]);
  const [sceneKey, setSceneKey] = useState("");
  const [model, setModel] = useState("sora");
  const [seconds, setSeconds] = useState(8);
  const [size, setSize] = useState("720x1280");
  const [userPrompt, setUserPrompt] = useState("");
  const [estimatedPoints, setEstimatedPoints] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [creationId, setCreationId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle / submitting / pending / running / completed / failed
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const pollTimer = useRef(null);
  const debounceRef = useRef(null);

  // 加载场景列表
  useEffect(() => {
    axios.get("/api/ai/scenes").then(({ data }) => {
      if (data?.success) {
        const videoScenes = (data.data || []).filter((s) => s.output_type === "video");
        setScenes(videoScenes);
        if (videoScenes.length > 0) {
          const first = videoScenes[0];
          setSceneKey(first.scene_key);
          setModel(first.default_model || "sora");
          setSeconds(first.default_seconds || 8);
          setSize(first.default_size || "720x1280");
          setEstimatedPoints(first.estimated_points ?? null);
        }
      }
    }).catch(() => {});

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  // 积分试算
  const doEstimate = useCallback(async (sk, m, s, sz) => {
    if (!sk) return;
    setEstimating(true);
    try {
      const { data } = await axios.post("/api/ai/estimate-points", {
        scene_key: sk,
        output_type: "video",
        model: m,
        seconds: s,
        size: sz,
      });
      if (data?.success) setEstimatedPoints(data.data.estimated_points);
    } catch {
      // 试算失败不阻塞主流程
    } finally {
      setEstimating(false);
    }
  }, [axios]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doEstimate(sceneKey, model, seconds, size), 600);
    return () => clearTimeout(debounceRef.current);
  }, [sceneKey, model, seconds, size, doEstimate]);

  const canSubmit = useMemo(
    () => userPrompt.trim().length > 10 && !loading && status !== "pending" && status !== "running",
    [userPrompt, loading, status]
  );

  const startPolling = useCallback(
    (cid) => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const { data } = await axios.get(`/api/ai/video-status/${cid}`);
          if (!data?.success) return;

          setStatus(data.status || "running");

          if (data.status === "completed" && data.content) {
            setVideoUrl(data.content);
            setThumbnailUrl(data.thumbnail_url || "");
            clearInterval(pollTimer.current);
            pollTimer.current = null;
            toast.success("视频生成完成！");
          } else if (data.status === "failed") {
            setErrorMsg(data.error_message || "Generation failed.");
            clearInterval(pollTimer.current);
            pollTimer.current = null;
            toast.error("视频生成失败，积分已返还");
          }
        } catch {
          // 轮询网络错误，忽略继续轮询
        }
      }, 5000);
    },
    [axios]
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      setVideoUrl("");
      setThumbnailUrl("");
      setErrorMsg("");
      setStatus("submitting");

      const { data } = await axios.post("/api/ai/generate-sora-video", {
        scene_key: sceneKey,
        user_prompt: userPrompt,
        model,
        seconds,
        size,
      });

      if (!data?.success) throw new Error(data?.message || "Submission failed");

      setCreationId(data.creation_id);
      setStatus(data.status || "pending");
      startPolling(data.creation_id);
      toast.success("视频任务已提交，正在生成…");
    } catch (e) {
      setStatus("idle");
      if (e?.response?.data?.code === "INSUFFICIENT_POINTS") {
        toast.error(
          `积分不足：需要 ${e.response.data.required_points} 积分，当前可用 ${e.response.data.available_points}`
        );
      } else {
        toast.error(e?.response?.data?.message || e?.message || "提交失败");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!creationId) return;
    try {
      const { data } = await axios.get(`/api/user/creations/${creationId}/download`);
      if (data?.success) window.open(data.data.download_url, "_blank");
    } catch {
      toast.error("下载失败");
    }
  };

  const statusLabel = {
    idle: "—",
    submitting: "Submitting…",
    pending: "Queued",
    running: "Processing…",
    completed: "Completed",
    failed: "Failed",
  }[status] ?? status;

  return (
    <div className="qa-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Sora Video Generator</h1>
            <p className="qa-muted mt-1 text-sm">Submit a task and poll until completion.</p>
          </div>
          <div className="qa-card flex items-center gap-2 px-3 py-2">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-xs text-slate-200">
              {estimating ? (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              ) : estimatedPoints != null ? (
                `~${estimatedPoints} pts`
              ) : (
                "— pts"
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 输入面板 */}
          <div className="qa-card p-5 space-y-4">
            <div>
              <label className="qa-muted text-xs">Scene</label>
              <select
                className="qa-input mt-2"
                value={sceneKey}
                onChange={(e) => setSceneKey(e.target.value)}
                disabled={scenes.length === 0}
              >
                {scenes.length === 0 ? (
                  <option>Loading scenes…</option>
                ) : (
                  scenes.map((s) => (
                    <option key={s.scene_key} value={s.scene_key}>{s.scene_name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="qa-muted text-xs">Duration</label>
                <select
                  className="qa-input mt-2"
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}s</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="qa-muted text-xs">Size</label>
                <select
                  className="qa-input mt-2"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                >
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="qa-muted text-xs">Prompt（附加要求）</label>
              <textarea
                className="qa-input mt-2 h-32 resize-none py-2"
                placeholder="e.g. 镜头环绕马克杯展示材质与蒸汽感，简洁背景"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="qa-muted text-xs">Status: <span className="text-slate-300">{statusLabel}</span></p>
                {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
              </div>
              <button
                className={canSubmit ? "qa-btn qa-btn-primary" : "qa-btn opacity-60"}
                disabled={!canSubmit}
                onClick={handleSubmit}
                type="button"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Submitting…" : "Generate"}
              </button>
            </div>
          </div>

          {/* 预览面板 */}
          <div className="qa-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">Preview</p>
              {status === "completed" && (
                <button className="qa-btn qa-btn-ghost" onClick={handleDownload} type="button">
                  <Download className="h-4 w-4" />
                  Download
                </button>
              )}
            </div>

            <div className="mt-4">
              {status === "completed" && videoUrl ? (
                <video
                  className="w-full rounded-lg border border-white/10"
                  controls
                  src={videoUrl}
                  poster={thumbnailUrl || undefined}
                />
              ) : status === "pending" || status === "running" ? (
                <div className="qa-card flex h-72 items-center justify-center bg-white/4">
                  <div className="flex flex-col items-center gap-3 text-sm text-slate-200">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>{status === "pending" ? "Task queued…" : "Generating video…"}</span>
                    <p className="qa-muted text-xs">This may take several minutes.</p>
                  </div>
                </div>
              ) : status === "failed" ? (
                <div className="qa-card flex h-72 items-center justify-center bg-red-900/10">
                  <p className="text-sm text-red-400">Generation failed. Points have been refunded.</p>
                </div>
              ) : (
                <div className="qa-card flex h-72 items-center justify-center">
                  <p className="qa-muted text-sm">Your generated video will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoraVideo;
