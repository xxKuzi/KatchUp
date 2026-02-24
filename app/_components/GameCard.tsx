import React from "react";
import { useRouter } from "next/navigation";

interface GameCardProps {
  name: string;
  img?: string;
  description?: string;
  color?: string;
  url?: string;
}

const colorVariants: Record<string, string> = {
  yellow: "from-yellow-600",
  red: "from-red-500",
  blue: "from-blue-500",
};

const GameCard = (props: GameCardProps) => {
  const router = useRouter();
  const { name, img, description, url, color = "blue" } = props;
  const gradientColor: string = colorVariants[color] || "from-gray-500";
  return (
    <button
      className={`relative group overflow-hidden border-gray-400 transition duration-300 hover:border-white w-[280px] h-[450px] border-2 rounded-lg flex flex-col items-center justify-end`}
      onClick={() => router.push(url || "")}
    >
      <div className="absolute top-0 left-0 group-hover:scale-105 bg-cover transition duration-300 bg-center bg-[url('/flip_cards.png')] w-full h-full flex-col flex items-center justify-end rounded-lg"></div>
      {/*<div className=" h-8 w-full"></div>*/}
      <div className="absolute top-2 right-2 bg-blue-500/60 text-green-100 rounded-sm px-2 py-1">
        <p className="">name</p>
      </div>
      <div
        className={`relative bg-gradient-to-t ${gradientColor}  to-blue-500/[0%] w-full h-[200px] rounded-md p-4 flex-col flex items-center justify-center`}
      >
        <h2 className="absolute bottom-8 text-4xl font-bold">{name}</h2>
        <p className="absolute bottom-2">{description}</p>
      </div>
    </button>
  );
};

export default GameCard;
