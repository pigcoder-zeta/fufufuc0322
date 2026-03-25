import { useState, useEffect, useCallback } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

const PAGE_SIZE = 12;

const STATUS_COLORS = {
  completed: { color: "#b8c3ff", bg: "rgba(184,195,255,0.1)" },
  running:   { color: "#e9c349", bg: "rgba(233,195,73,0.1)"  },
  pending:   { color: "#c2c7d0", bg: "rgba(194,199,208,0.1)" },
  failed:    { color: "#ffb4ab", bg: "rgba(255,180,171,0.1)" },
};

const AssetCard = ({ item, selected, onToggle, onSingleDownload }) => {
  const isExpired  = item.expires_at && new Date(item.expires_at) < new Date();
  const canAct     = item.status === "completed" && !isExpired;
  const sCfg       = STATUS_COLORS[item.status] || STATUS_COLORS.completed;
  const daysLeft   = item.expires_at
    ? Math.max(0, Math.ceil((new Date(item.expires_at) - Date.now()) / 86400000))
    : null;

  return (
    <div className="group rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
      style={{
        background: "#181c22",
        ...(selected && { outline: "2px solid rgba(184,195,255,0.5)" }),
      }}>
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9", background: "#0a0e14" }}>
        {item.type === "video"
          ? item.thumbnail_url
            ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl" style={{ color: "#45474b" }}>movie_filter</span>
              </div>
          : item.content
            ? <img src={item.content} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl" style={{ color: "#45474b" }}>auto_awesome</span>
              </div>
        }

        {/* Status badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: "rgba(16,20,26,0.85)", backdropFilter: "blur(10px)", color: sCfg.color }}>
          {item.status === "running" || item.status === "pending"
            ? <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: sCfg.color }} />
            : <span className="w-1.5 h-1.5 rounded-full" style={{ background: sCfg.color }} />
          }
          {item.status.toUpperCase()}
        </div>

        {/* Expired overlay */}
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(10,14,20,0.75)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8f9095" }}>Expired</span>
          </div>
        )}

        {/* Select checkbox */}
        {canAct && (
          <button onClick={() => onToggle(item.id)}
            className="absolute top-3 left-3 w-6 h-6 rounded-md flex items-center justify-center transition-all"
            style={{
              background: selected ? "rgba(184,195,255,0.9)" : "rgba(16,20,26,0.7)",
              border: `1px solid ${selected ? "#b8c3ff" : "rgba(69,71,75,0.5)"}`,
            }}>
            {selected && <span className="material-symbols-outlined text-[14px] filled" style={{ color: "#002388" }}>check</span>}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3">
          <h3 className="font-bold text-sm leading-snug mb-1 truncate"
            style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
            {item.scene_name || "AI Generation"}
          </h3>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#c2c7d0", opacity: 0.55 }}>
            {item.type} • {new Date(item.created_at).toLocaleDateString("zh-CN")}
            {item.points_cost > 0 && ` • ${item.points_cost} pts`}
          </p>
        </div>

        {/* Expiry indicator */}
        {daysLeft !== null && !isExpired && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1" style={{ color: "#8f9095" }}>
              <span>Expires in</span>
              <span style={{ color: daysLeft <= 5 ? "#ffb4ab" : "#c2c7d0" }}>{daysLeft}d</span>
            </div>
            <div className="w-full h-1 rounded-full" style={{ background: "#0a0e14" }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (daysLeft / 30) * 100)}%`,
                  background: daysLeft <= 5 ? "#ffb4ab" : "#b8c3ff",
                }} />
            </div>
          </div>
        )}

        {/* Download button */}
        <div className="mt-auto">
          <button
            onClick={() => canAct && onSingleDownload(item.id)}
            disabled={!canAct}
            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: canAct
                ? "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)"
                : "#262a31",
              color: canAct ? "#002388" : "#8f9095",
              fontFamily: "Manrope, sans-serif",
            }}>
            <span className="material-symbols-outlined text-sm">download</span>
            {isExpired ? "Expired" : canAct ? "Download Without Watermark" : item.status === "failed" ? "Failed" : "Processing…"}
          </button>
        </div>
      </div>
    </div>
  );
};

const History = () => {
  const authAxios = useAuthAxios();

  const [tab,       setTab]       = useState("all");
  const [items,     setItems]     = useState([]);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState(new Set());
  const [batchLoading, setBatch]  = useState(false);

  const typeParam = tab === "all" ? undefined : tab;

  const load = useCallback((pg = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: pg, page_size: PAGE_SIZE });
    if (typeParam) params.set("type", typeParam);
    authAxios.get(`/api/user/get-user-creations?${params}`)
      .then(r => {
        setItems(pg === 1 ? r.data.creations || [] : prev => [...prev, ...(r.data.creations || [])]);
        setTotal(r.data.total ?? (r.data.creations?.length ?? 0));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [typeParam, authAxios]);

  useEffect(() => { setPage(1); setSelected(new Set()); load(1); }, [tab]);

  const loadMore = () => { const next = page + 1; setPage(next); load(next); };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAllCompleted = () => {
    const completedIds = items
      .filter(i => i.status === "completed" && new Date(i.expires_at) > new Date())
      .map(i => i.id);
    setSelected(new Set(completedIds));
  };

  const clearSelection = () => setSelected(new Set());

  const handleSingleDownload = async (id) => {
    try {
      const { data } = await authAxios.get(`/api/user/creations/${id}/download`);
      if (data?.data?.download_url) {
        const a = document.createElement("a"); a.href = data.data.download_url;
        a.download = `creation_${id}`; a.click();
      }
    } catch { toast.error("Download failed"); }
  };

  const handleBatchDownload = async () => {
    if (selected.size === 0) return;
    if (selected.size > 20) { toast.error("Batch download limit: 20 items"); return; }
    setBatch(true);
    try {
      const resp = await authAxios.post(
        "/api/user/creations/download/batch",
        { creation_ids: [...selected] },
        { headers: { "X-Idempotency-Key": uuidv4() }, responseType: "blob" }
      );
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a"); a.href = url; a.download = "creations.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Batch download started");
    } catch { toast.error("Batch download failed"); }
    finally { setBatch(false); }
  };

  const handleCsvExport = async () => {
    try {
      const resp = await authAxios.get("/api/user/creations/export/csv", { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a"); a.href = url; a.download = "creations.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV export started");
    } catch { toast.error("CSV export failed"); }
  };

  const hasMore = items.length < total;

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-extrabold mb-2"
            style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em" }}>
            Asset Download Center
          </h2>
          <p className="text-lg" style={{ color: "#c2c7d0", opacity: 0.7 }}>
            Manage all your high-definition image and video assets.
          </p>
        </div>
        <div className="flex gap-3 mt-1">
          {selected.size > 0 && (
            <>
              <span className="text-sm flex items-center gap-1" style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
                {selected.size} selected
              </span>
              <button onClick={handleBatchDownload} disabled={batchLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)",
                  color: "#002388",
                  fontFamily: "Manrope, sans-serif",
                }}>
                {batchLoading
                  ? <span className="w-4 h-4 rounded-full border-2 border-[#002388] border-t-transparent animate-spin" />
                  : <span className="material-symbols-outlined text-sm">download_for_offline</span>
                }
                Batch Download
              </button>
              <button onClick={clearSelection}
                className="px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                style={{ background: "#262a31", color: "#c2c7d0" }}>
                Clear
              </button>
            </>
          )}
          <button onClick={handleCsvExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:opacity-80"
            style={{ background: "#262a31", color: "#c2c7d0", fontFamily: "Manrope, sans-serif" }}>
            <span className="material-symbols-outlined text-sm">table_chart</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-8 p-1.5 rounded-full w-fit"
        style={{ background: "#181c22" }}>
        {[
          { key: "all",   label: "All Assets" },
          { key: "image", label: "Image Assets" },
          { key: "video", label: "Video Assets" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-6 py-2 rounded-full text-sm font-bold transition-all"
            style={{
              background: tab === key ? "#b8c3ff" : "transparent",
              color:      tab === key ? "#002388" : "#c2c7d0",
              fontFamily: "Manrope, sans-serif",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Select all row */}
      {items.some(i => i.status === "completed") && (
        <div className="flex items-center gap-4 mb-6">
          <button onClick={selectAllCompleted}
            className="text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
            Select All Completed
          </button>
          {selected.size > 0 && (
            <span className="text-sm" style={{ color: "#8f9095" }}>
              {selected.size} / 20 max selected
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-[#b8c3ff] border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 rounded-2xl" style={{ background: "#181c22" }}>
          <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: "#45474b" }}>image_not_supported</span>
          <p className="font-bold mb-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>No assets found</p>
          <p className="text-sm" style={{ color: "#8f9095" }}>Generate your first AI content to see it here</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => (
              <AssetCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={toggleSelect}
                onSingleDownload={handleSingleDownload}
              />
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-10">
              <button onClick={loadMore} disabled={loading}
                className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80 active:scale-95"
                style={{ background: "#1c2026", color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
                {loading ? "Loading…" : `Load More (${total - items.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;
