import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "../hooks/useAuthAxios";
import { useAuthing } from "../contexts/AuthingContext";

const STATUS_CONFIG = {
  completed: { label: "COMPLETE",    color: "#b8c3ff", dot: "#b8c3ff" },
  running:   { label: "PROCESSING",  color: "#e9c349", dot: "#e9c349", pulse: true },
  pending:   { label: "QUEUED",      color: "#c2c7d0", dot: "#c2c7d0", pulse: true },
  failed:    { label: "FAILED",      color: "#ffb4ab", dot: "#ffb4ab" },
};

const CreationCard = ({ item, onDownload }) => {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.completed;
  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
  const canDownload = item.status === "completed" && !isExpired;

  return (
    <div className="group cursor-pointer" onClick={() => canDownload && onDownload(item.id)}>
      <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 relative"
        style={{ background: "#181c22", border: "1px solid rgba(69,71,75,0.12)" }}>
        {item.content
          ? <img src={item.thumbnail_url || item.content} alt={item.scene_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          : <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl" style={{ color: "#45474b" }}>
                {item.type === "video" ? "movie_filter" : "auto_awesome"}
              </span>
            </div>
        }
        {/* Status badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(16,20,26,0.82)", backdropFilter: "blur(12px)", color: cfg.color }}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? "animate-pulse" : ""}`}
            style={{ background: cfg.dot }} />
          {cfg.label}
        </div>
        {/* Expired overlay */}
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
            style={{ background: "rgba(10,14,20,0.72)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8f9095" }}>Expired</span>
          </div>
        )}
      </div>
      <h4 className="font-bold text-sm truncate"
        style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
        {item.scene_name || "Generation"}
      </h4>
      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "#c2c7d0", opacity: 0.6 }}>
        <span className="capitalize">{item.type}</span>
        <span>•</span>
        <span>{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
        {item.points_cost > 0 && <><span>•</span><span>{item.points_cost} pts</span></>}
      </p>
    </div>
  );
};

const Dashboard = () => {
  const navigate   = useNavigate();
  const { user }   = useAuthing();
  const authAxios  = useAuthAxios();

  const [account,   setAccount]   = useState(null);
  const [creations, setCreations] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      authAxios.get("/api/points/balance"),
      authAxios.get("/api/user/get-user-creations?page_size=8"),
    ]).then(([balRes, crRes]) => {
      setAccount(balRes.data?.data);
      setCreations(crRes.data?.creations || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id) => {
    try {
      const { data } = await authAxios.get(`/api/user/creations/${id}/download`);
      if (data?.data?.download_url) {
        const a = document.createElement("a");
        a.href = data.data.download_url;
        a.download = `creation_${id}`;
        a.click();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      {/* Hero greeting */}
      <section className="mb-14">
        <h2 className="text-[2.6rem] font-extrabold leading-tight mb-3"
          style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em" }}>
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.<br />
          <span style={{ color: "#b8c3ff" }}>Ready to create trending content?</span>
        </h2>
        <p className="text-lg max-w-xl" style={{ color: "#c2c7d0", opacity: 0.7 }}>
          Architecture for your digital imagination. Choose a foundation to begin your next generation.
        </p>
      </section>

      {/* Account stats */}
      {account && (
        <div className="grid grid-cols-3 gap-4 mb-14">
          {[
            { label: "Available Points", value: account.available_points ?? 0,  icon: "bolt",             color: "#b8c3ff" },
            { label: "Held Points",      value: account.held_points ?? 0,        icon: "lock_clock",       color: "#e9c349" },
            { label: "Membership",       value: (account.membership_tier || "free").toUpperCase(), icon: "workspace_premium", color: "#c2c7d0" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: "#181c22" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#0a0e14" }}>
                <span className="material-symbols-outlined text-xl" style={{ color }}>{icon}</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: "#8f9095" }}>{label}</p>
                <p className="text-lg font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick access bento */}
      <section className="grid grid-cols-12 gap-5 mb-14">
        {/* AI Image card */}
        <div className="col-span-12 lg:col-span-7 group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-500"
          style={{ background: "#181c22", border: "1px solid rgba(69,71,75,0.08)" }}
          onClick={() => navigate("/ai/scene-image")}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "linear-gradient(135deg, rgba(184,195,255,0.08) 0%, transparent 70%)" }} />
          <div className="flex items-center p-8 gap-8">
            <div className="w-20 h-20 flex-shrink-0 rounded-full flex items-center justify-center"
              style={{ background: "#0a0e14", border: "1px solid rgba(69,71,75,0.2)" }}>
              <span className="material-symbols-outlined text-5xl" style={{ color: "#b8c3ff" }}>auto_awesome</span>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                AI Image Generation
              </h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "#c2c7d0", opacity: 0.7 }}>
                Synthesize ultra-high resolution e-commerce visuals with neural architecture models.
              </p>
              <button className="liquid-metal px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                style={{ color: "#002388", fontFamily: "Manrope, sans-serif" }}>
                Start Drafting
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Video card */}
        <div className="col-span-12 lg:col-span-5 group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-500"
          style={{ background: "#262a31", border: "1px solid rgba(69,71,75,0.14)" }}
          onClick={() => navigate("/ai/sora-video")}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: "linear-gradient(135deg, rgba(233,195,73,0.06) 0%, transparent 70%)" }} />
          <div className="flex items-center p-8 gap-6">
            <div className="w-20 h-20 flex-shrink-0 rounded-full flex items-center justify-center"
              style={{ background: "#0a0e14", border: "1px solid rgba(69,71,75,0.2)" }}>
              <span className="material-symbols-outlined text-5xl" style={{ color: "#e9c349" }}>movie_filter</span>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                AI Video
              </h3>
              <p className="text-sm mb-6" style={{ color: "#c2c7d0", opacity: 0.7 }}>
                Cinematic Sora-2 motion synthesis.
              </p>
              <button className="px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:border-opacity-60 active:scale-95"
                style={{ background: "#31353c", color: "#dfe2eb", border: "1px solid rgba(69,71,75,0.35)", fontFamily: "Manrope, sans-serif" }}>
                New Motion
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Recent creations */}
      <section>
        <div className="flex items-end justify-between mb-8 px-1">
          <div>
            <h3 className="text-2xl font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
              Recent Creations
            </h3>
            <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "#c2c7d0", opacity: 0.5 }}>
              Archive — Latest Submissions
            </p>
          </div>
          <button onClick={() => navigate("/ai/history")}
            className="text-sm font-semibold flex items-center gap-1 transition-opacity hover:opacity-80"
            style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
            View All History
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#b8c3ff] border-t-transparent animate-spin" />
          </div>
        ) : creations.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: "#181c22" }}>
            <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: "#45474b" }}>image_not_supported</span>
            <p className="font-bold mb-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>No creations yet</p>
            <p className="text-sm mb-6" style={{ color: "#8f9095" }}>Generate your first AI image or video</p>
            <button onClick={() => navigate("/ai/scene-image")}
              className="liquid-metal px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ color: "#002388", fontFamily: "Manrope, sans-serif" }}>
              Start Creating
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creations.map(item => (
              <CreationCard key={item.id} item={item} onDownload={handleDownload} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-20 pt-8 flex justify-between items-center"
        style={{ borderTop: "1px solid rgba(69,71,75,0.1)", opacity: 0.5 }}>
        <p className="text-[10px]" style={{ color: "#c2c7d0" }}>© 2025 VisionAI. Built by Digital Architects.</p>
        <div className="flex gap-6">
          <a href="https://t.me/quickai_support" target="_blank" rel="noreferrer"
            className="text-[10px] hover:underline transition-colors"
            style={{ color: "#c2c7d0" }}>Contact</a>
          <a href="mailto:support@quickai.com"
            className="text-[10px] hover:underline transition-colors"
            style={{ color: "#c2c7d0" }}>Email Support</a>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
