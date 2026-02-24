import React, { use } from "react";
import { useRouter } from "next/navigation";

function GameNavbar() {
  const router = useRouter();
  return (
    <div className="relative flex justify-between items-center border-b hover:border-white transition duration-200 border-white/40 sm:min-w-[600px] rounded-xl w-[40%] hover-b-2">
      <p className="absolute right-2 bottom-[-20]">focus {"\;"})</p>
      <button
        className="px-4 py-2 cursor-pointer"
        onClick={() => router.push("/")}
      >
        back
      </button>
      <p>Health Bar |-----|</p>
      <button
        className="px-4 py-2 cursor-pointer"
        onClick={() => router.push("/")}
      >
        leaderboard {";)"}
      </button>
    </div>
  );
}

export default GameNavbar;
