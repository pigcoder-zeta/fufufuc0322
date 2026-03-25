import { useNavigate } from "react-router-dom";
import { useAuthing } from "../contexts/AuthingContext";

const FeatureCheck = ({ text }) => (
  <li className="flex items-center gap-3 text-sm" style={{ color: "#c2c7d0" }}>
    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
      style={{ background: "rgba(184,195,255,0.15)" }}>
      <span className="material-symbols-outlined filled text-[13px]" style={{ color: "#b8c3ff" }}>check</span>
    </span>
    {text}
  </li>
);

const Home = () => {
  const navigate = useNavigate();
  const { isSignedIn, user, login, logout } = useAuthing();

  return (
    <div className="min-h-screen flex" style={{ background: "#10141a" }}>
      {/* ── Left brand section ── */}
      <aside className="hidden lg:flex w-1/2 flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0a0e14 0%, #181c22 60%, #1c2026 100%)" }}>
        {/* Background glow */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(184,195,255,0.06) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(233,195,73,0.05) 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#b8c3ff" }}>
            <span className="material-symbols-outlined filled text-xl" style={{ color: "#002388" }}>architecture</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>VisionAI</h1>
            <p className="text-[9px] uppercase tracking-[0.2em] font-medium" style={{ color: "#c2c7d0", opacity: 0.5 }}>The Digital Architect</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: "rgba(184,195,255,0.08)", border: "1px solid rgba(184,195,255,0.2)", color: "#b8c3ff" }}>
            <span className="material-symbols-outlined text-sm">bolt</span>
            AI Creative Platform
          </div>
          <h2 className="text-5xl font-extrabold leading-tight mb-6"
            style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.025em" }}>
            Your AI<br />
            <span style={{ color: "#b8c3ff" }}>Digital Architect</span><br />
            for E-Commerce.
          </h2>
          <p className="text-lg mb-10 max-w-md leading-relaxed" style={{ color: "#c2c7d0", opacity: 0.7 }}>
            加入 10,000+ 顶尖电商卖家的行列，用 AI 打造高转化率的视觉营销物料。
          </p>

          <ul className="space-y-4 mb-12">
            {[
              "Nano Banana 2 旗舰图像引擎",
              "Sora 2 级物理仿真视频生成",
              "注册即赠送 300 体验积分",
              "无订阅，按用量灵活充值",
            ].map(t => <FeatureCheck key={t} text={t} />)}
          </ul>

          {/* Stats */}
          <div className="flex gap-12">
            {[
              { stat: "10K+",  label: "Active Sellers" },
              { stat: "2M+",   label: "Assets Generated" },
              { stat: "99.9%", label: "Uptime" },
            ].map(({ stat, label }) => (
              <div key={stat}>
                <p className="text-2xl font-bold" style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>{stat}</p>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#8f9095" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom label */}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest relative z-10" style={{ color: "#8f9095" }}>
          <span className="w-2 h-2 rounded-full" style={{ background: "#b8c3ff" }} />
          Digital Architect System v2.4
        </div>
      </aside>

      {/* ── Right login section ── */}
      <main className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12"
        style={{ background: "#10141a" }}>
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-12">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#b8c3ff" }}>
                <span className="material-symbols-outlined filled text-lg" style={{ color: "#002388" }}>architecture</span>
              </div>
              <span className="text-2xl font-bold tracking-tighter" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                VisionAI
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3"
              style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em" }}>
              {isSignedIn ? `欢迎回来, ${user?.name?.split(" ")[0] || ""}` : "欢迎回来"}
            </h2>
            <p className="text-sm" style={{ color: "#8f9095" }}>
              {isSignedIn ? "您已登录，进入工作台继续创造" : "登录您的 VisionAI 账号，继续创造爆款"}
            </p>
          </div>

          {isSignedIn ? (
            /* Logged in state */
            <div className="space-y-4">
              {/* Avatar row */}
              <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: "#181c22" }}>
                {user?.imageUrl
                  ? <img src={user.imageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  : <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ background: "#1c2026", color: "#b8c3ff" }}>
                      {user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                    {user?.name || "User"}
                  </p>
                  <p className="text-sm truncate" style={{ color: "#8f9095" }}>{user?.email}</p>
                </div>
              </div>

              <button onClick={() => navigate("/ai")}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)",
                  color: "#002388",
                  fontFamily: "Manrope, sans-serif",
                  boxShadow: "0 8px 32px rgba(184,195,255,0.15)",
                }}>
                <span className="material-symbols-outlined">dashboard</span>
                进入工作台
              </button>

              <button onClick={() => logout()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ color: "#8f9095", background: "transparent" }}>
                切换账号
              </button>
            </div>
          ) : (
            /* Guest state */
            <div className="space-y-6">
              {/* Main CTA */}
              <button onClick={() => login()}
                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)",
                  color: "#002388",
                  fontFamily: "Manrope, sans-serif",
                  boxShadow: "0 8px 32px rgba(184,195,255,0.15)",
                }}>
                <span className="material-symbols-outlined text-xl">login</span>
                安全登录 / 免费注册
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full" style={{ borderTop: "1px solid rgba(69,71,75,0.3)" }} />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-[10px] uppercase tracking-widest" style={{ background: "#10141a", color: "#8f9095" }}>
                    由 Authing 提供安全认证
                  </span>
                </div>
              </div>

              {/* Trust features */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: "shield_with_heart", label: "企业级安全" },
                  { icon: "bolt",             label: "秒级响应"   },
                  { icon: "lock",             label: "数据加密"   },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2 py-3 rounded-xl"
                    style={{ background: "#181c22" }}>
                    <span className="material-symbols-outlined text-lg" style={{ color: "#b8c3ff" }}>{icon}</span>
                    <span className="text-[10px] font-semibold text-center" style={{ color: "#8f9095" }}>{label}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-xs" style={{ color: "#8f9095" }}>
                注册即视为同意{" "}
                <a href="https://t.me/quickai_support" target="_blank" rel="noreferrer"
                  className="hover:underline" style={{ color: "#b8c3ff" }}>服务条款</a>
                {" "}与{" "}
                <a href="https://t.me/quickai_support" target="_blank" rel="noreferrer"
                  className="hover:underline" style={{ color: "#b8c3ff" }}>隐私政策</a>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
