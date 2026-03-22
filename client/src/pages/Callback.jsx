/**
 * OAuth 回调页面
 * Authing 完成登录后会带着 code 参数重定向到此页面。
 * AuthingContext 在初始化时会检测到 isRedirectCallback() 为 true，
 * 自动完成 token 交换并恢复登录态，随后跳转到 /ai。
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthing } from "../contexts/AuthingContext";

const Callback = () => {
  const navigate   = useNavigate();
  const { isReady, isSignedIn } = useAuthing();

  useEffect(() => {
    if (isReady) {
      navigate(isSignedIn ? "/ai" : "/", { replace: true });
    }
  }, [isReady, isSignedIn, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0f14]">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p>正在完成登录，请稍候…</p>
      </div>
    </div>
  );
};

export default Callback;
