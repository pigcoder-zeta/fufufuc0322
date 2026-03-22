import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";
import { Download, Image, Loader2, Sparkles } from "lucide-react";

const SceneImage = () => {
  const axios = useAuthAxios();

  const [scenes, setScenes] = useState([]);
  const [sceneKey, setSceneKey] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [userPrompt, setUserPrompt] = useState("");
  const [estimatedPoints, setEstimatedPoints] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { url, creationId, expiresAt }

  const debounceRef = useRef(null);

  // 加载场景列表
  useEffect(() => {
    axios.get("/api/ai/scenes").then(({ data }) => {
      if (data?.success) {
        const imgScenes = (data.data || []).filter((s) => s.output_type === "image");
        setScenes(imgScenes);
        if (imgScenes.length > 0) {
          setSceneKey(imgScenes[0].scene_key);
          setEstimatedPoints(imgScenes[0].estimated_points ?? null);
          setSize(imgScenes[0].default_size || "1024x1024");
        }
      }
    }).catch(() => {});
  }, []);

  // 积分试算（debounce 500ms）
  const doEstimate = useCallback(async (sk, sz) => {
    if (!sk) return;
    setEstimating(true);
    try {
      const { data } = await axios.post("/api/ai/estimate-points", {
        scene_key: sk,
        output_type: "image",
        size: sz || undefined,
      });
      if (data?.success) {
        setEstimatedPoints(data.data.estimated_points);
      }
    } catch {
      // 试算失败不影响主流程
    } finally {
      setEstimating(false);
    }
  }, [axios]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doEstimate(sceneKey, size), 500);
    return () => clearTimeout(debounceRef.current);
  }, [sceneKey, size, doEstimate]);

  const currentScene = useMemo(() => scenes.find((s) => s.scene_key === sceneKey), [scenes, sceneKey]);
  const canGenerate = useMemo(() => userPrompt.trim().length > 5 && !loading, [userPrompt, loading]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    try {
      setLoading(true);
      setResult(null);
      const { data } = await axios.post("/api/ai/generate-scene-image", {
        scene_key: sceneKey,
        user_prompt: userPrompt,
        size,
      });
      if (!data?.success) throw new Error(data?.message || "Generation failed");
      setResult({ url: data.content, creationId: data.creation_id, expiresAt: data.expires_at });
      toast.success("图片已生成");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "图片生成失败";
      if (e?.response?.data?.code === "INSUFFICIENT_POINTS") {
        toast.error(`积分不足：需要 ${e.response.data.required_points} 积分，当前可用 ${e.response.data.available_points}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.creationId) return;
    try {
      const { data } = await axios.get(`/api/user/creations/${result.creationId}/download`);
      if (data?.success) {
        window.open(data.data.download_url, "_blank");
      }
    } catch {
      toast.error("下载失败");
    }
  };

  return (
    <div className="qa-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Scene Image Generator</h1>
            <p className="qa-muted mt-1 text-sm">
              Generate commercial-grade product images with AI.
            </p>
          </div>
          <div className="qa-card flex items-center gap-2 px-3 py-2">
            <Image className="h-4 w-4 text-primary" />
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
          <div className="qa-card p-5">
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

            <label className="qa-muted mt-4 block text-xs">Size</label>
            <select
              className="qa-input mt-2"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="1024x1024">1024 × 1024</option>
              <option value="1024x1792">1024 × 1792（竖版）</option>
              <option value="1792x1024">1792 × 1024（横版）</option>
            </select>

            <label className="qa-muted mt-4 block text-xs">Prompt（附加要求）</label>
            <textarea
              className="qa-input mt-2 h-28 resize-none py-2"
              placeholder="e.g. 白色马克杯，旁边放半块柠檬，背景干净简洁"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="qa-muted text-xs">
                {currentScene ? currentScene.scene_name : "Select a scene above"}
              </p>
              <button
                className={canGenerate ? "qa-btn qa-btn-primary" : "qa-btn opacity-60"}
                disabled={!canGenerate}
                onClick={handleGenerate}
                type="button"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>

          {/* 预览面板 */}
          <div className="qa-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">Preview</p>
              {result?.url && (
                <button
                  className="qa-btn qa-btn-ghost"
                  onClick={handleDownload}
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              )}
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="qa-card flex h-72 animate-pulse items-center justify-center bg-white/4">
                  <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    Generating your image…
                  </div>
                </div>
              ) : result?.url ? (
                <>
                  <img
                    src={result.url}
                    alt="generated"
                    className="w-full rounded-lg border border-white/10"
                  />
                  {result.expiresAt && (
                    <p className="qa-muted mt-2 text-xs">
                      Expires {new Date(result.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : (
                <div className="qa-card flex h-72 items-center justify-center">
                  <p className="qa-muted text-sm">Your generated image will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneImage;
