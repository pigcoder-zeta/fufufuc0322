import axios from "axios";
import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAuthing } from "../contexts/AuthingContext";

const useAuthAxios = () => {
  const { getToken } = useAuthing();

  const authAxios = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_BASE_URL || "http://localhost:5000",
    });

    instance.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error("Error getting Authing token:", error);
      }

      // 为所有会改变状态的请求自动注入幂等键
      const mutatingMethods = ["post", "put", "patch", "delete"];
      if (mutatingMethods.includes(config.method?.toLowerCase())) {
        if (!config.headers["X-Idempotency-Key"]) {
          config.headers["X-Idempotency-Key"] = uuidv4();
        }
      }

      return config;
    });

    return instance;
  }, [getToken]);

  return authAxios;
};

export default useAuthAxios;
