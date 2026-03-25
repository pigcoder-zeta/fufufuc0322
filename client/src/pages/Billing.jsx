import { useState, useEffect } from "react";
import useAuthAxios from "../hooks/useAuthAxios";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

const ENTRY_TYPE_LABELS = {
  reserve:  { label: "Reserve",  color: "#e9c349" },
  charge:   { label: "Charge",   color: "#ffb4ab" },
  release:  { label: "Release",  color: "#b8c3ff" },
  recharge: { label: "Recharge", color: "#52d87a" },
  bonus:    { label: "Bonus",    color: "#e9c349" },
};

const MOCK_PAYMENT_DELAY = 1800; // ms

const PackageCard = ({ pkg, recommended, onBuy, buying }) => (
  <div className="relative flex flex-col rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02]"
    style={{
      background: recommended ? "#1c2026" : "#181c22",
      border: recommended ? "2px solid rgba(184,195,255,0.45)" : "1px solid rgba(69,71,75,0.15)",
      boxShadow: recommended ? "0 0 40px rgba(184,195,255,0.06)" : "none",
    }}>
    {recommended && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
        style={{ background: "#b8c3ff", color: "#002388" }}>
        Recommended
      </div>
    )}

    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-3xl"
          style={{ color: recommended ? "#e9c349" : "#8f9095" }}>
          {recommended ? "workspace_premium" : pkg.points >= 100000 ? "corporate_fare" : "rocket_launch"}
        </span>
      </div>
      <h3 className="text-xl font-bold mb-1" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
        {pkg.package_name}
      </h3>
      <p className="text-3xl font-bold mt-3" style={{ color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
        ¥{(pkg.price_cents / 100).toFixed(0)}
        <span className="text-sm font-normal ml-1" style={{ color: "#8f9095" }}>/ recharge</span>
      </p>
    </div>

    <ul className="flex-1 space-y-3 mb-8">
      {[
        { icon: "bolt",          text: `${pkg.total_points.toLocaleString()} Generation Points`,         active: true },
        { icon: "image",         text: `~${Math.floor(pkg.total_points / 100)} High-Res Images`,         active: true },
        { icon: "movie_filter",  text: pkg.total_points >= 10000 ? "SORA-2 Video Access" : "SORA-2 Not Included", active: pkg.total_points >= 10000 },
        { icon: "priority_high", text: pkg.total_points >= 10000 ? "Priority Queue Access" : "Standard Queue", active: pkg.total_points >= 10000 },
      ].map(({ icon, text, active }) => (
        <li key={text} className="flex items-center gap-3 text-sm"
          style={{ color: active ? "#dfe2eb" : "#8f9095" }}>
          <span className="material-symbols-outlined text-lg filled"
            style={{ color: active ? (recommended ? "#b8c3ff" : "#8f9095") : "#45474b" }}>
            {active ? "check_circle" : "cancel"}
          </span>
          <span className={!active ? "line-through opacity-50" : ""}>{text}</span>
        </li>
      ))}
      {pkg.bonus_points > 0 && (
        <li className="flex items-center gap-3 text-sm">
          <span className="material-symbols-outlined text-lg filled" style={{ color: "#e9c349" }}>stars</span>
          <span style={{ color: "#e9c349", fontWeight: 600 }}>
            +{pkg.bonus_points.toLocaleString()} Bonus Points!
          </span>
        </li>
      )}
    </ul>

    <button onClick={() => onBuy(pkg)} disabled={buying}
      className="w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: recommended ? "linear-gradient(135deg, #b8c3ff 0%, #4d70ff 100%)" : "transparent",
        color: recommended ? "#002388" : "#dfe2eb",
        border: recommended ? "none" : "1px solid rgba(69,71,75,0.4)",
        fontFamily: "Manrope, sans-serif",
      }}>
      {buying ? "Processing…" : `Recharge ¥${(pkg.price_cents / 100).toFixed(0)}`}
    </button>
  </div>
);

const LedgerRow = ({ entry }) => {
  const cfg = ENTRY_TYPE_LABELS[entry.entry_type] || { label: entry.entry_type, color: "#c2c7d0" };
  return (
    <div className="flex items-center justify-between py-4"
      style={{ borderBottom: "1px solid rgba(69,71,75,0.1)" }}>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(69,71,75,0.2)" }}>
          <span className="material-symbols-outlined text-sm" style={{ color: cfg.color }}>
            {entry.entry_type === "recharge" ? "add_card" :
             entry.entry_type === "charge"   ? "remove_circle" :
             entry.entry_type === "reserve"  ? "lock" :
             entry.entry_type === "release"  ? "lock_open" : "stars"}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ color: cfg.color, background: `${cfg.color}18` }}>
              {cfg.label}
            </span>
            {entry.metadata?.scene_key && (
              <span className="text-[10px]" style={{ color: "#8f9095" }}>
                {entry.metadata.scene_key}
              </span>
            )}
          </div>
          <p className="text-[11px]" style={{ color: "#8f9095" }}>
            {entry.note || "—"}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-6">
        <p className="text-sm font-bold" style={{
          color: entry.change_points > 0 ? "#52d87a" : entry.change_points < 0 ? "#ffb4ab" : "#c2c7d0",
          fontFamily: "Manrope, sans-serif",
        }}>
          {entry.change_points > 0 ? "+" : ""}{entry.change_points}
        </p>
        <p className="text-[10px]" style={{ color: "#8f9095" }}>
          Bal: {entry.balance_after} pts
        </p>
        <p className="text-[10px]" style={{ color: "#45474b" }}>
          {new Date(entry.created_at).toLocaleDateString("zh-CN")}
        </p>
      </div>
    </div>
  );
};

const Billing = () => {
  const authAxios = useAuthAxios();

  const [account,  setAccount]  = useState(null);
  const [packages, setPackages] = useState([]);
  const [ledger,   setLedger]   = useState([]);
  const [ledgerPg, setLedgerPg] = useState(1);
  const [ledgerTot,setLedgerTot]= useState(0);
  const [loading,  setLoading]  = useState(true);
  const [buyingPkg,setBuyingPkg]= useState(null);

  // Load initial data
  useEffect(() => {
    Promise.all([
      authAxios.get("/api/points/balance"),
      authAxios.get("/api/points/packages"),
      authAxios.get("/api/points/ledger?page=1&page_size=15"),
    ]).then(([balRes, pkgRes, ledRes]) => {
      setAccount(balRes.data?.data);
      setPackages(pkgRes.data?.data || []);
      setLedger(ledRes.data?.data?.items || []);
      setLedgerTot(ledRes.data?.data?.total ?? 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const refreshBalance = async () => {
    const { data } = await authAxios.get("/api/points/balance");
    setAccount(data?.data);
  };

  const handleBuy = async (pkg) => {
    setBuyingPkg(pkg.package_key);
    try {
      // 1. Create order
      const orderRes = await authAxios.post("/api/points/orders",
        { package_key: pkg.package_key },
        { headers: { "X-Idempotency-Key": uuidv4() } }
      );
      const { order_no } = orderRes.data?.data || {};
      if (!order_no) throw new Error("Order creation failed");

      // 2. Mock payment confirmation
      toast("Simulating payment…", { icon: "💳" });
      await new Promise(r => setTimeout(r, MOCK_PAYMENT_DELAY));

      // 3. Confirm order
      const confirmRes = await authAxios.post(
        `/api/points/orders/${order_no}/confirm`,
        {},
        { headers: { "X-Idempotency-Key": uuidv4() } }
      );
      const confirmData = confirmRes.data?.data;
      if (!confirmData) throw new Error("Confirmation failed");

      toast.success(`${confirmData.granted_points.toLocaleString()} points added! Balance: ${confirmData.available_points} pts`);
      await refreshBalance();

      // Refresh ledger
      const ledRes = await authAxios.get("/api/points/ledger?page=1&page_size=15");
      setLedger(ledRes.data?.data?.items || []);
      setLedgerPg(1);
    } catch (err) {
      toast.error(err.response?.data?.message || "Payment failed");
    } finally {
      setBuyingPkg(null);
    }
  };

  const loadMoreLedger = async () => {
    const next = ledgerPg + 1;
    try {
      const { data } = await authAxios.get(`/api/points/ledger?page=${next}&page_size=15`);
      setLedger(prev => [...prev, ...(data?.data?.items || [])]);
      setLedgerPg(next);
      setLedgerTot(data?.data?.total ?? ledgerTot);
    } catch (_) {}
  };

  const recommended = packages.find(p => p.points >= 10000 && p.points < 100000)?.package_key;

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
          style={{ background: "rgba(184,195,255,0.08)", border: "1px solid rgba(184,195,255,0.2)", color: "#b8c3ff" }}>
          <span className="material-symbols-outlined text-sm">bolt</span>
          Flexible Recharge
        </span>
        <h2 className="text-5xl font-extrabold mb-4"
          style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          Flexible Recharge, Create<br />
          <span style={{ color: "#b8c3ff" }}>Trending Products on Demand.</span>
        </h2>
        <p className="text-lg max-w-xl mx-auto" style={{ color: "#c2c7d0", opacity: 0.7 }}>
          Scale your digital architecture with precisely allocated tokens. No long-term commitments, just pure creative power.
        </p>
      </div>

      {/* Account balance summary */}
      {!loading && account && (
        <div className="flex justify-center mb-14">
          <div className="inline-flex items-center gap-8 px-8 py-4 rounded-2xl"
            style={{ background: "#0a0e14", border: "1px solid rgba(69,71,75,0.2)" }}>
            {[
              { label: "Available",  value: account.available_points ?? 0, color: "#b8c3ff" },
              { label: "Held",       value: account.held_points ?? 0,      color: "#e9c349" },
              { label: "Balance",    value: account.balance_points ?? 0,   color: "#c2c7d0" },
            ].map(({ label, value, color }, i) => (
              <div key={label} className="text-center" style={{ ...(i > 0 && { paddingLeft: 32, borderLeft: "1px solid rgba(69,71,75,0.2)" }) }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#8f9095" }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color, fontFamily: "Manrope, sans-serif" }}>
                  {value.toLocaleString()}
                </p>
                <p className="text-[10px]" style={{ color: "#8f9095" }}>points</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[#b8c3ff] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {packages.map(pkg => (
            <PackageCard
              key={pkg.package_key}
              pkg={pkg}
              recommended={pkg.package_key === recommended}
              onBuy={handleBuy}
              buying={buyingPkg === pkg.package_key}
            />
          ))}
          {packages.length === 0 && (
            <div className="col-span-3 text-center py-16" style={{ color: "#8f9095" }}>
              No packages available
            </div>
          )}
        </div>
      )}

      {/* Features bento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-20">
        <div className="md:col-span-2 rounded-2xl p-6"
          style={{ background: "linear-gradient(135deg, rgba(184,195,255,0.05) 0%, #181c22 100%)", border: "1px solid rgba(69,71,75,0.12)" }}>
          <h4 className="text-lg font-bold mb-2 flex items-center gap-2" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
            <span className="material-symbols-outlined" style={{ color: "#e9c349" }}>bolt</span>
            Why Flexible?
          </h4>
          <p className="text-xs leading-relaxed" style={{ color: "#c2c7d0", opacity: 0.7 }}>
            VisionAI tokens never expire. Use them today or save them for your next major product launch. Total control, zero waste.
          </p>
        </div>
        {[
          { stat: "99.9%", label: "Uptime Guaranteed", icon: "verified" },
          { stat: "24/7",  label: "Expert Support",    icon: "support_agent" },
        ].map(({ stat, label, icon }) => (
          <div key={stat} className="rounded-2xl p-6 flex flex-col justify-between"
            style={{ background: "#181c22", border: "1px solid rgba(69,71,75,0.12)" }}>
            <span className="material-symbols-outlined text-2xl mb-2" style={{ color: "#b8c3ff" }}>{icon}</span>
            <h4 className="text-2xl font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>{stat}</h4>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#8f9095" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="flex flex-col items-center justify-center pb-16"
        style={{ borderBottom: "1px solid rgba(69,71,75,0.12)" }}>
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold mb-8" style={{ color: "#8f9095" }}>
          Secure Payment Gateway
        </p>
        <div className="flex items-center gap-12 opacity-50 hover:opacity-100 transition-all duration-500 grayscale hover:grayscale-0">
          {[
            { label: "WeChat Pay", icon: "account_balance_wallet", color: "#52d87a" },
            { label: "Alipay",     icon: "shield_with_heart",      color: "#60a5fa" },
            { label: "Secure 256-bit", icon: "lock",              color: "#dfe2eb" },
          ].map(({ label, icon, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="material-symbols-outlined filled" style={{ color }}>{icon}</span>
              <span className="font-bold text-lg" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif", letterSpacing: "-0.02em" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ledger */}
      <section className="mt-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>
              Points Ledger
            </h3>
            <p className="text-xs mt-1" style={{ color: "#8f9095" }}>All point transactions, newest first</p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: "#181c22" }}>
          <div className="px-6 pt-6">
            {ledger.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: "#45474b" }}>receipt_long</span>
                <p className="font-bold" style={{ color: "#dfe2eb", fontFamily: "Manrope, sans-serif" }}>No transactions yet</p>
              </div>
            ) : (
              ledger.map(e => <LedgerRow key={e.id} entry={e} />)
            )}
          </div>

          {ledger.length < ledgerTot && (
            <div className="px-6 pb-6 pt-4">
              <button onClick={loadMoreLedger}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80"
                style={{ background: "#262a31", color: "#b8c3ff", fontFamily: "Manrope, sans-serif" }}>
                Load More ({ledgerTot - ledger.length} remaining)
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Billing;
