import React from "react";
import { useRouter } from "next/navigation";

interface GameCardProps {
  name: string;
  img?: string;
  description?: string;
  color?: string;
  url?: string;
  feature?: string;
  featureColor?: string;
}

const colorVariants: Record<string, string> = {
  yellow: "from-amber-600/95 via-amber-600/50",
  red: "from-rose-600/95 via-rose-600/50",
  blue: "from-blue-600/95 via-blue-600/50",
  green: "from-emerald-600/95 via-emerald-600/50",
};

const featureColorVariants: Record<string, string> = {
  yellow: "bg-amber-500/80 text-white",
  red: "bg-rose-500/80 text-white",
  blue: "bg-blue-500/80 text-white",
  green: "bg-emerald-500/80 text-white",
};

const GameCard = (props: GameCardProps) => {
  const router = useRouter();
  const {
    name,
    img,
    description,
    url,
    color = "blue",
    feature = "",
    featureColor = "green",
  } = props;
  const gradientColor: string = colorVariants[color] || "from-gray-500";
  const featureColorConst: string =
    featureColorVariants[featureColor] || "from-gray-500";
  const isClickable = Boolean(url);

  return (
    <button
      className={`relative group overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 hover:border-slate-400 dark:hover:border-slate-500 hover:-translate-y-1 hover:shadow-xl w-[260px] h-[350px] sm:w-[280px] sm:h-[420px] shrink-0 border-2 rounded-2xl flex flex-col items-center justify-end ${
        isClickable ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={() => {
        if (url) {
          router.push(url);
        }
      }}
      type="button"
    >
      <div
        style={img ? { backgroundImage: `url('/${img}')` } : undefined}
        className={`absolute top-0 left-0 group-hover:scale-105 bg-cover transition duration-500 bg-center w-full h-full rounded-2xl`}
      />
      {feature && (
        <div
          className={`${featureColorConst} absolute top-3 right-3 shadow-sm text-xs font-bold uppercase tracking-wider rounded-lg px-2.5 py-1 z-10 backdrop-blur-sm`}
        >
          {feature}
        </div>
      )}
      <div
        className={`relative bg-gradient-to-t ${gradientColor} to-transparent w-full h-3/5 rounded-b-2xl p-5 flex-col flex items-start justify-end z-0`}
      >
        <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight leading-tight drop-shadow-md">
          {name}
        </h2>
        <p className="text-white/90 text-sm sm:text-base font-medium mt-1.5 drop-shadow-sm">
          {description}
        </p>
      </div>
    </button>
  );
};

export default GameCard;
