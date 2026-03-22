import {
  CreditCard,
  House,
  Image,
  LogOut,
  Video,
  MessageSquare,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuthing } from "../contexts/AuthingContext";

const navItems = [
  { to: "/ai",              label: "Dashboard",   Icon: House },
  { to: "/ai/scene-image",  label: "Scene Image",  Icon: Image },
  { to: "/ai/sora-video",   label: "Sora Video",   Icon: Video },
  { to: "/ai/billing",      label: "Billing",      Icon: CreditCard },
  { to: "https://t.me/quickai_support", label: "Contact Us", Icon: MessageSquare, external: true },
];

const Sidebar = ({ sidebar, setSidebar }) => {
  const { user, logout } = useAuthing();

  if (!user) return null;

  return (
    <div
      className={`w-64 border-r border-white/10 bg-black/35 backdrop-blur flex flex-col justify-between items-center max-sm:absolute top-14 bottom-0 ${
        sidebar ? "translate-x-0" : "max-sm:-translate-x-full"
      } transition-all duration-300 ease-in-out z-10`}
    >
      <div className="my-7 w-full">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt="User avatar"
            className="w-13 rounded-full mx-auto ring-1 ring-white/10"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/40 flex items-center justify-center text-lg text-white mx-auto ring-1 ring-white/10">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <h1 className="mt-2 text-center text-sm font-medium text-slate-200">{user.name}</h1>

        <div className="px-4 mt-6 text-sm text-slate-300 font-medium">
          {navItems.map((item) => {
            const Icon = item.Icon;

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.to}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition hover:bg-white/6 hover:text-slate-100"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  {item.label}
                </a>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/ai"}
                onClick={() => setSidebar(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition ${
                    isActive
                      ? "bg-white/10 text-slate-50 ring-1 ring-white/10"
                      : "hover:bg-white/6 hover:text-slate-100"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 ${isActive ? "text-slate-50" : "text-slate-400"}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="w-full border-t border-white/10 p-4 px-6 flex items-center justify-between">
        <div className="flex gap-3 items-center">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="User avatar"
              className="w-8 rounded-full ring-1 ring-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/40 flex items-center justify-center text-xs text-white ring-1 ring-white/10">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div>
            <h1 className="text-sm font-medium text-slate-200">{user.name}</h1>
            <p className="text-xs text-slate-500 truncate max-w-[100px]">{user.email}</p>
          </div>
        </div>
        <LogOut
          onClick={() => logout()}
          className="w-4.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        />
      </div>
    </div>
  );
};

export default Sidebar;
