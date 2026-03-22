import { useNavigate } from "react-router-dom";
import { Image, Video, Sparkles } from "lucide-react";

const AiToolsData = [
  {
    title: "Scene Image Generator",
    description: "Generate high-quality scene images for e-commerce products",
    Icon: Image,
    bg: { from: "#3C81F6", to: "#9234EA" },
    path: "/ai/scene-image"
  },
  {
    title: "Sora 2 Video Generator",
    description: "Create stunning promotional videos using Sora 2",
    Icon: Video,
    bg: { from: "#FF61C5", to: "#9E53EE" },
    path: "/ai/sora-video"
  }
];

const AiTools = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto my-20 max-w-6xl px-4 sm:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-slate-100 sm:text-4xl">Tools</h2>
        <p className="qa-muted mx-auto mt-3 max-w-lg text-sm leading-6">
          Minimal, production-minded generators for images and short video.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {AiToolsData.map((tool, index) => (
          <div
            key={index}
            onClick={() => navigate(tool.path)}
            className="qa-card qa-card-hover cursor-pointer p-6"
          >
            <tool.Icon
              className="h-12 w-12 rounded-xl p-3 text-white"
              style={{
                background: `linear-gradient(to bottom, ${tool.bg.from}, ${tool.bg.to})`,
              }}
            />
            <h3 className="mt-5 text-lg font-semibold text-slate-100">{tool.title}</h3>
            <p className="qa-muted mt-2 text-sm leading-6">
              {tool.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AiTools;
