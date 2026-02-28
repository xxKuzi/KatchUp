import React, { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

function Navbar() {
  const router = useRouter();
  return (
    <div className="z-10 fixed top-0 bg-black flex justify-between items-center border-b p-2 mt-2 hover:border-white transition duration-200 border-white/60 sm:min-w-[600px] rounded-xl w-[40%] hover-b-2">
      <div className="flex items-center justify-center">
        <button
          className="px-4 py-2 cursor-pointer text-white/[80%] hover:text-white"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="inline mr-2" />
        </button>
        <button
          className="px-4 py-2 cursor-pointer text-white/[80%] hover:text-white transition duration-200 rounded-lg"
          onClick={() => router.push("/")}
        >
          Home
        </button>
        <button
          className="px-4 py-2 cursor-pointer text-white/[80%] hover:text-white"
          onClick={() => router.push("/")}
        >
          leaderboard {";)"}
        </button>
      </div>
      <p className="pr-4">
        Health Bar <span className="text-green-300">OOOO</span>
      </p>
    </div>
  );
}

export default Navbar;
