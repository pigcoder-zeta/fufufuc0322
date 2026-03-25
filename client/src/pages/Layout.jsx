import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthing } from "../contexts/AuthingContext";
import useAuthAxios from "../hooks/useAuthAxios";

const NAV_ITEMS = [
  { to: "/ai",             label: "Dashboard",  icon: "dashboard" },
  { to: "/ai/scene-image", label: "AI Image",   icon: "auto_awesome" },
  { to: "/ai/sora-video",  label: "AI Video",   icon: "movie_filter" },
  { to: "/ai/history",     label: "History",    icon: "history" },
  { to: "/ai/billing",     label: "Billing",    icon: "payments" },
];

const Sidebar = ({ collapsed, user, balance, logout }) => (
  <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col z-50"
    style={{ background: "#181c22" }}>
    <div className="flex flex-col h-full py-6 px-4">
      {/* Brand */}
      <div className="mb-10 px-2 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "#b8c3ff" }}>
          <span className="material-symbols-outlined filled text-sm"
            style={{ color: "#002388" }}>architecture</span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tighter font-headline"
            style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
            VisionAI
          </h1>
          <p className="text-[9px] uppercase tracking-[0.18em] font-medium"
            style={{ color: "#c2c7d0", opacity: 0.55 }}>
            The Digital Architect
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === "/ai"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl mx-1 transition-all duration-200 text-sm font-bold cursor-pointer select-none
               ${isActive
                ? "text-[#b8c3ff] bg-[#1c2026] scale-[0.97]"
                : "text-[#c2c7d0] hover:text-[#dfe2eb] hover:bg-[#1c2026]"}`
            }
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {({ isActive }) => (<>
              <span className={`material-symbols-outlined ${isActive ? "filled" : ""}`}>{icon}</span>
              {label}
            </>)}
          </NavLink>
        ))}

        {/* Enterprise CTA */}
        <a href="https://t.me/quickai_support" target="_blank" rel="noreferrer"
          className="flex items-center gap-3 px-4 py-3 rounded-xl mx-1 transition-all duration-200 text-sm font-bold"
          style={{ color: "#e9c349", fontFamily: "Manrope, sans-serif" }}>
          <span className="material-symbols-outlined">settings_suggest</span>
          Enterprise
        </a>
      </nav>

      {/* User footer */}
      <div className="mt-auto pt-5 space-y-1"
        style={{ borderTop: "1px solid rgba(69,71,75,0.18)" }}>
        {/* Balance pill */}
        <div className="mx-2 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "#0a0e14" }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#b8c3ff" }}>bolt</span>
          <span className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
            {balance ?? "—"} pts
          </span>
        </div>

        {/* Avatar row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {user?.imageUrl
              ? <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover"
                  style={{ border: "1px solid rgba(69,71,75,0.4)" }} />
              : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "#262a31", color: "#b8c3ff" }}>
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate"
                style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
                {user?.name || "User"}
              </p>
              <p className="text-[10px] truncate" style={{ color: "#c2c7d0", opacity: 0.6 }}>
                {user?.email || ""}
              </p>
            </div>
          </div>
          <button onClick={logout} className="transition-opacity opacity-60 hover:opacity-100 ml-2 flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]" style={{ color: "#c2c7d0" }}>logout</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
);

const Layout = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoading, user, login, logout } = useAuthing();
  const authAxios = useAuthAxios();
  const [balance, setBalance] = useState(null);

  // Redirect if not signed in
  useEffect(() => {
    if (!isLoading && !isSignedIn) login();
  }, [isLoading, isSignedIn, login]);

  // Fetch points balance for top bar
  useEffect(() => {
    if (!isSignedIn) return;
    authAxios.get("/api/points/balance")
      .then(r => setBalance(r.data?.data?.available_points ?? 0))
      .catch(() => {});
  }, [isSignedIn]);

  if (isLoading || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#10141a" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-[#b8c3ff] border-t-transparent animate-spin" />
          <p className="text-sm" style={{ color: "#c2c7d0" }}>Loading VisionAI…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#10141a" }}>
      <Sidebar user={user} balance={balance} logout={logout} />

      {/* Main */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 h-16 z-40 flex items-center justify-between px-8 glass-nav"
          style={{ width: "calc(100% - 16rem)" }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-sm" style={{ color: "#8f9095" }}>search</span>
            <span className="text-sm" style={{ color: "#8f9095", fontFamily: "Inter, sans-serif" }}>
              VisionAI Workbench
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]" style={{ color: "#b8c3ff" }}>bolt</span>
              <span className="text-sm font-bold uppercase tracking-widest"
                style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
                {balance ?? "—"} Remaining
              </span>
            </div>
            <div className="flex items-center gap-3">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover cursor-pointer"
                    style={{ border: "1px solid rgba(69,71,75,0.4)" }}
                    onClick={() => navigate("/ai")} />
                : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
                    style={{ background: "#262a31", color: "#b8c3ff", border: "1px solid rgba(69,71,75,0.4)" }}
                    onClick={() => navigate("/ai")}>
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
              }
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mt-16 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
