import { useEffect, useState } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";
import { CreditCard, Gem, Loader2, RefreshCw } from "lucide-react";

const ENTRY_TYPE_LABELS = {
  recharge:          "充值",
  membership_grant:  "会员月赠",
  reserve:           "预占",
  charge:            "扣减",
  release:           "返还",
  manual_adjustment: "手工调整",
  expire:            "过期",
};

const Billing = () => {
  const axios = useAuthAxios();
  const [account, setAccount] = useState(null);
  const [packages, setPackages] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const fetchBalance = async () => {
    const { data } = await axios.get("/api/points/balance");
    if (data?.success) setAccount(data.data);
  };

  const fetchPackages = async () => {
    const { data } = await axios.get("/api/points/packages");
    if (data?.success) setPackages(data.data || []);
  };

  const fetchLedger = async () => {
    const { data } = await axios.get("/api/points/ledger");
    if (data?.success) setLedger(data.data || []);
  };

  useEffect(() => {
    Promise.all([fetchBalance(), fetchPackages(), fetchLedger()]).finally(() =>
      setInitLoading(false)
    );
  }, []);

  const buy = async (packageKey) => {
    try {
      setLoading(true);
      // 创建订单
      const orderRes = await axios.post("/api/points/orders", { package_key: packageKey });
      if (!orderRes.data?.success) throw new Error(orderRes.data?.message || "Failed to create order");

      const orderNo = orderRes.data.data.order_no;

      // 模拟支付确认（一期）
      const confirmRes = await axios.post(`/api/points/orders/${orderNo}/confirm`);
      if (!confirmRes.data?.success) throw new Error(confirmRes.data?.message || "Payment failed");

      toast.success(`充值成功，已获得 ${confirmRes.data.data.granted_points} 积分`);
      await Promise.all([fetchBalance(), fetchLedger()]);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const formatCents = (cents) => `¥${(cents / 100).toFixed(0)}`;

  return (
    <div className="qa-page">
      <div className="mx-auto max-w-5xl">
        {/* 余额卡片 */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Billing</h1>
            <p className="qa-muted mt-1 text-sm">Purchase points to generate images and videos.</p>
          </div>

          <div className="qa-card flex items-center gap-4 px-5 py-4">
            <Gem className="h-5 w-5 text-primary" />
            {account ? (
              <div>
                <p className="qa-muted text-xs">Available</p>
                <p className="text-xl font-semibold text-slate-100">
                  {Number(account.available_points).toLocaleString()} pts
                </p>
                {account.held_points > 0 && (
                  <p className="qa-muted text-xs">{account.held_points} pts reserved</p>
                )}
                {account.membership_tier !== "free" && (
                  <p className="mt-1 text-xs text-primary">
                    {account.membership_tier.toUpperCase()} · next bonus{" "}
                    {account.next_bonus_at
                      ? new Date(account.next_bonus_at).toLocaleDateString()
                      : "—"}
                  </p>
                )}
              </div>
            ) : (
              <div className="h-8 w-28 animate-pulse rounded bg-white/10" />
            )}
            <button className="qa-btn qa-btn-ghost" onClick={fetchBalance} type="button">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 套餐 */}
        {initLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="qa-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{pkg.package_name}</p>
                    <p className="qa-muted mt-1 text-sm">
                      {pkg.bonus_points > 0
                        ? `含赠送 ${pkg.bonus_points} 积分`
                        : "即时到账"}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-slate-100">{formatCents(pkg.price_cents)}</p>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-sm text-slate-200">{(pkg.points + pkg.bonus_points).toLocaleString()} 积分</p>
                  <button
                    className="qa-btn qa-btn-primary"
                    onClick={() => buy(pkg.package_key)}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    购买
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 计费规则说明 */}
        <div className="qa-card mt-4 p-6">
          <p className="text-sm font-semibold text-slate-100">Usage</p>
          <p className="qa-muted mt-2 text-sm leading-6">
            图片生成约 100 积分 · 视频生成约 300–600 积分（视时长和尺寸而定）。
            生成失败会自动全额返还积分。
          </p>
        </div>

        {/* 积分流水 */}
        {ledger.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">积分流水</h3>
            <div className="space-y-2">
              {ledger.map((entry) => (
                <div key={entry.id} className="qa-card flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="text-slate-200">
                      {ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
                    </span>
                    {entry.note && (
                      <p className="qa-muted mt-0.5 text-xs">{entry.note}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        entry.change_points > 0
                          ? "font-medium text-emerald-400"
                          : entry.change_points < 0
                          ? "font-medium text-red-400"
                          : "text-slate-400"
                      }
                    >
                      {entry.change_points > 0 ? "+" : ""}
                      {entry.change_points} pts
                    </p>
                    <p className="qa-muted text-xs">
                      余额 {entry.balance_after} pts
                    </p>
                    <p className="qa-muted text-xs">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Billing;
