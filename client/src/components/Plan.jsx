import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

const Plan = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "$10",
      subtitle: "Best for testing the pipeline",
      items: ["1,000 points", "Scene images", "Sora videos", "CSV + ZIP export"],
      cta: "Buy Starter",
      tone: "secondary",
    },
    {
      name: "Pro",
      price: "$100",
      subtitle: "For teams shipping weekly",
      items: ["10,000 points", "Priority queue", "Batch exports", "Usage dashboard"],
      cta: "Buy Pro",
      tone: "primary",
    },
  ];

  return (
    <div className="mx-auto my-20 max-w-6xl px-4 sm:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-slate-100 sm:text-4xl">Pricing</h2>
        <p className="qa-muted mx-auto mt-3 max-w-lg text-sm leading-6">
          Simple points-based pricing. Quiet UI, predictable costs.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.name} className="qa-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{p.name}</p>
                <p className="qa-muted mt-1 text-sm">{p.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-slate-100">{p.price}</p>
                <p className="qa-muted text-xs">one-time</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2 text-sm">
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-slate-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/6 ring-1 ring-white/10">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </span>
                  {it}
                </li>
              ))}
            </ul>

            <button
              className={p.tone === "primary" ? "qa-btn qa-btn-primary mt-6 w-full" : "qa-btn mt-6 w-full"}
              onClick={() => navigate("/ai/billing")}
              type="button"
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Plan;
