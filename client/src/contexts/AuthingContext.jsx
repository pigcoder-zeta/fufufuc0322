/**
 * Authing 认证上下文
 *
 * 替代原 Clerk 的 ClerkProvider / useAuth / useUser。
 * 基于 @authing/web SDK，使用 PKCE 授权码流程。
 *
 * 环境变量（client/.env）：
 *   VITE_AUTHING_APP_ID        Authing 应用 App ID
 *   VITE_AUTHING_DOMAIN        Authing 应用域名，如 https://your-app.authing.cn
 *   VITE_AUTHING_REDIRECT_URI  登录回调地址，如 http://localhost:5173/callback
 *   VITE_AUTHING_LOGOUT_URI    登出跳转地址，如 http://localhost:5173/
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Authing } from "@authing/web";

const AuthingContext = createContext(null);

const APP_ID       = import.meta.env.VITE_AUTHING_APP_ID       || "";
const APP_DOMAIN   = import.meta.env.VITE_AUTHING_DOMAIN       || "";
const REDIRECT_URI = import.meta.env.VITE_AUTHING_REDIRECT_URI || `${window.location.origin}/callback`;
const LOGOUT_URI   = import.meta.env.VITE_AUTHING_LOGOUT_URI   || `${window.location.origin}/`;

let authingSingleton = null;
const getAuthing = () => {
  if (!authingSingleton && APP_ID && APP_DOMAIN) {
    authingSingleton = new Authing({
      appId:            APP_ID,
      domain:           APP_DOMAIN,
      redirectUri:      REDIRECT_URI,
      logoutRedirectUri: LOGOUT_URI,
    });
  }
  return authingSingleton;
};

export const AuthingProvider = ({ children }) => {
  const [user, setUser]         = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [isReady, setReady]     = useState(false);
  const tokenRef                = useRef(null);

  // 获取最新 Access Token（优先用缓存，过期前刷新）
  const getToken = useCallback(async () => {
    const sdk = getAuthing();
    if (!sdk) return null;
    try {
      const state = await sdk.getLoginState();
      if (state?.accessToken) {
        tokenRef.current = state.accessToken;
        return state.accessToken;
      }
    } catch (_) {}
    return tokenRef.current;
  }, []);

  const login = useCallback(() => {
    getAuthing()?.loginWithRedirect();
  }, []);

  const logout = useCallback(() => {
    const sdk = getAuthing();
    if (sdk) {
      sdk.logoutWithRedirect();
    } else {
      window.location.href = "/";
    }
  }, []);

  useEffect(() => {
    const sdk = getAuthing();
    if (!sdk) {
      // 未配置 Authing（开发模式 mock）
      setUser({ id: "dev_user_001", name: "Dev User", email: "dev@example.com", imageUrl: null });
      setLoading(false);
      setReady(true);
      return;
    }

    const init = async () => {
      try {
        // 处理 OAuth 回调（带 code 参数时）
        if (sdk.isRedirectCallback()) {
          await sdk.handleRedirectCallback();
          // 清除 URL 中的 code/state 参数后刷新，使页面进入正常登录态
          window.history.replaceState({}, "", window.location.pathname);
        }

        const state = await sdk.getLoginState();
        if (state?.userInfo) {
          const info = state.userInfo;
          tokenRef.current = state.accessToken;
          setUser({
            id:        info.sub || info.userId,
            name:      info.name || info.nickname || info.username || "用户",
            email:     info.email || "",
            imageUrl:  info.picture || null,
            phone:     info.phone_number || "",
            raw:       info,
          });
        }
      } catch (err) {
        console.error("Authing init error:", err);
      } finally {
        setLoading(false);
        setReady(true);
      }
    };

    init();
  }, []);

  const value = {
    user,
    isLoading,
    isReady,
    isSignedIn: !!user,
    getToken,
    login,
    logout,
  };

  return (
    <AuthingContext.Provider value={value}>
      {children}
    </AuthingContext.Provider>
  );
};

/** 主 hook，替代 useAuth / useUser */
export const useAuthing = () => {
  const ctx = useContext(AuthingContext);
  if (!ctx) throw new Error("useAuthing must be used within AuthingProvider");
  return ctx;
};

export default AuthingContext;
