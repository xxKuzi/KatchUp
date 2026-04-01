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
  yellow: "from-yellow-600",
  red: "from-red-500",
  blue: "from-blue-500",
  green: "from-green-500",
};

const featureColorVariants: Record<string, string> = {
  yellow: "bg-yellow-500/60 text-yellow-100",
  red: "bg-red-500/60 text-red-100",
  blue: "bg-blue-500/70 text-blue-100",
  green: "bg-green-500/60 text-green-100",
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

  return (
    <button
      className={`relative group overflow-hidden border-gray-200 dark:border-gray-400 transition duration-300 hover:border-gray-700 dark:hover:border-white xl:min-w-[280px] xl:max-w-[280px] xl:min-h-[450px] border-2 rounded-lg flex flex-col items-center justify-end`}
      onClick={() => router.push(url || "")}
    >
      <div
        style={img ? { backgroundImage: `url('/${img}')` } : undefined}
        className={`absolute top-0 left-0 group-hover:scale-105 bg-cover transition duration-300 bg-center w-full h-full flex-col flex items-center justify-end rounded-lg`}
      />
      {/*<div className=" h-8 w-full"></div>*/}
      <div
        className={` ${featureColorConst} absolute top-2 right-2 bg-blue-500/60 text-green-100 rounded-sm px-2 py-1`}
      >
        <p className="">{feature}</p>
      </div>
      <div
        className={`relative bg-gradient-to-t ${gradientColor} to-blue-500/[0%] w-full h-[200px] rounded-md p-4 flex-col flex items-center justify-center`}
      >
        <h2 className="absolute dark:text-white text-white font- bottom-8 text-4xl font-bold">
          {name}
        </h2>
        <p className="absolute dark:text-white bottom-2">{description}</p>
      </div>
    </button>
  );
};

export default GameCard;
