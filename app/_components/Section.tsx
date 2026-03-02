import React from "react";

const Section = ({ color, children }: any) => {
  const colorVariants: Record<string, string> = {
    yellow: "bg-yellow-500/60 text-yellow-100",
    red: "bg-red-500/60 text-red-100",
    blue: "bg-blue-500/70 text-blue-100",
    green: "bg-green-500/60 text-green-100",
  };
  const gradientColor: string = colorVariants[color] || "bg-white text-black";

  return (
    <div className={`w-screen ${gradientColor} py-4 px-[70px]`}>{children}</div>
  );
};

export default Section;
