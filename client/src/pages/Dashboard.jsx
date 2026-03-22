import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileDown, Gem, MessageSquare, Sparkles } from "lucide-react";
import CreationItem from "../components/CreationItem";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";

const Dashboard = () => {
  const axios = useAuthAxios();
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const now = new Date();

  const completedCreations = useMemo(
    () => creations.filter((c) => c.status === "completed"),
    [creations]
  );

  const getDashboardData = async () => {
    try {
      setLoading(true);
      const [creationsRes, balanceRes] = await Promise.all([
        axios.get("/api/user/get-user-creations"),
        axios.get("/api/points/balance"),
      ]);

      if (creationsRes.data?.success) {
        setCreations(creationsRes.data.creations || []);
      }
      if (balanceRes.data?.success) {
        setAccount(balanceRes.data.data);
      }
    } catch (e) {
      toast.error(e?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDashboardData();
  }, []);

  const isExpired = (item) =>
    item.expires_at && new Date(item.expires_at) < now;

  const handleSingleDownload = async (item) => {
    if (isExpired(item)) {
      toast.error("This creation has expired.");
      return;
    }
    try {
      const { data } = await axios.get(`/api/user/creations/${item.id}/download`);
      if (data?.success) window.open(data.data.download_url, "_blank");
    } catch {
      toast.error("Download failed");
    }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await axios.post(
        "/api/user/creations/download/batch",
        { creation_ids: selectedIds },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "creations_batch.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Batch download failed");
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await axios.get("/api/user/creations/export/csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "creations_history.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("CSV export failed");
    }
  };

  return (
    <div className="qa-page h-full overflow-y-auto">
      {/* 顶部统计卡片 */}
      <div className="flex flex-wrap items-stretch gap-4">
        {/* 总创作数 */}
        <div className="qa-card flex w-56 items-center justify-between p-5">
          <div>
            <p className="qa-muted text-sm">Total Creations</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-100">{creations.length}</h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* 积分余额 */}
        <div className="qa-card flex w-64 items-center justify-between p-5">
          <div>
            <p className="qa-muted text-sm">Available Points</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-100">
              {account ? Number(account.available_points).toLocaleString() : "—"} pts
            </h2>
            {account && account.held_points > 0 && (
              <p className="qa-muted mt-1 text-xs">{account.held_points} pts reserved</p>
            )}
            {account && account.membership_tier !== "free" && (
              <p className="mt-1 text-xs text-primary">{account.membership_tier.toUpperCase()} member</p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
            <Gem className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* 导出操作 */}
        <div className="qa-card flex flex-1 min-w-[280px] items-center justify-between gap-3 p-5">
          <div>
            <p className="qa-muted text-sm">Exports</p>
            <p className="mt-1 text-sm text-slate-200">Batch ZIP and CSV history.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="qa-btn"
              disabled={selectedIds.length === 0}
              onClick={handleBatchDownload}
              type="button"
            >
              <Download className="h-4 w-4" />
              Batch ZIP ({selectedIds.length})
            </button>
            <button className="qa-btn" onClick={handleExportCSV} type="button">
              <FileDown className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* 联系入口 */}
        <div className="qa-card flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">Need help?</p>
            <a
              href="https://t.me/quickai_support"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Contact Support <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 历史记录列表 */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Recent Creations</h3>
            <p className="qa-muted mt-1 text-xs">
              Select completed items to batch export. Expired items cannot be downloaded.
            </p>
          </div>
          <button className="qa-btn qa-btn-ghost" onClick={getDashboardData} type="button">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
          </div>
        ) : completedCreations.length === 0 ? (
          <div className="qa-card p-6 text-sm text-slate-300">No creations yet. Go generate something!</div>
        ) : (
          <div className="space-y-3">
            {completedCreations.map((item) => {
              const expired = isExpired(item);
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <input
                    className="mt-5 h-4 w-4 rounded border-white/20 bg-white/5 text-primary disabled:opacity-30"
                    type="checkbox"
                    disabled={expired}
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedIds((prev) =>
                        checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                      );
                    }}
                  />
                  <div className={`flex-1 ${expired ? "opacity-50" : ""}`}>
                    <CreationItem
                      item={item}
                      expired={expired}
                      onDownload={() => handleSingleDownload(item)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
