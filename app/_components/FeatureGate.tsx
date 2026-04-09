"use client";

import React from "react";

interface FeatureGateProps {
  isAllowed: boolean;
  message: string;
  children: React.ReactNode;
  className?: string;
}

export default function FeatureGate(props: FeatureGateProps) {
  const { isAllowed, message, children, className = "" } = props;

  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none blur-[6px] opacity-35">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-md rounded-3xl border border-slate-200/80 bg-white/85 px-6 py-5 text-center shadow-xl backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/85">
          <div className="mx-auto mb-3 h-4 w-24 rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-300 opacity-70" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</p>
        </div>
      </div>
    </div>
  );
}
