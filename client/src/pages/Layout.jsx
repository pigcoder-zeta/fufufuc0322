import { Outlet, useNavigate } from "react-router-dom";
import { assets } from "../assets/assets";
import { Menu, X, LogIn } from "lucide-react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuthing } from "../contexts/AuthingContext";

const Layout = () => {
  const navigate        = useNavigate();
  const [sidebar, setSidebar] = useState(false);
  const { isSignedIn, isLoading, user, logout, login } = useAuthing();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0f14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSignedIn) {
    login();
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0f14]">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p>正在跳转到登录页面…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <nav className="w-full border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="qa-btn qa-btn-ghost px-2"
            type="button"
          >
            <span className="rounded-md bg-white/90 px-2 py-1">
              <img src={assets.logo} alt="logo" className="w-32 sm:w-40" />
            </span>
          </button>

          <div className="flex items-center gap-4">
            {/* 用户头像 */}
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.name}
                className="h-8 w-8 rounded-full ring-1 ring-white/20 cursor-pointer"
                onClick={() => navigate("/ai")}
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full bg-primary/40 flex items-center justify-center text-xs text-white cursor-pointer ring-1 ring-white/20"
                onClick={() => navigate("/ai")}
              >
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}

            {/* 移动端菜单切换 */}
            {sidebar ? (
              <X onClick={() => setSidebar(false)} className="h-6 w-6 text-slate-300 sm:hidden" />
            ) : (
              <Menu onClick={() => setSidebar(true)} className="h-6 w-6 text-slate-300 sm:hidden" />
            )}
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-64px)] w-full flex-1">
        <Sidebar sidebar={sidebar} setSidebar={setSidebar} />
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(900px_circle_at_50%_-10%,rgba(109,94,252,0.18),transparent_55%),radial-gradient(700px_circle_at_10%_60%,rgba(56,189,248,0.10),transparent_55%)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
