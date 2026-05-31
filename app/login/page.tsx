"use client";

import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Gamepad2 } from "lucide-react";

gsap.registerPlugin(useGSAP);

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Entrance animation
    gsap.from(".animate-item", {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: "power3.out",
      clearProps: "opacity,transform", // Ensures opacity and transforms are reset to allow clicks
    });
  }, { scope: container });

  const loginWithProvider = async (provider: "google" | "github" | "apple") => {
    await signIn(provider, { callbackUrl: "/" });
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-8 sm:py-10" ref={container}>
      <div className="animate-item first-section-static-glow w-full rounded-4xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:p-10">
        <div className="text-center sm:text-left">
          <p className="animate-item text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Account
          </p>
          <h1 className="animate-item mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
            Welcome to KatchUp
          </h1>
          <p className="animate-item mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Ready to test your vocabulary? Sign in to save your progress, or jump right into the action and play as a guest first.
          </p>
        </div>

        {isSignedIn ? (
          <div className="mt-8 space-y-4">
            <div className="animate-item rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Currently signed in as{" "}
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {session?.user?.name || session?.user?.email || "user"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="animate-item w-full cursor-pointer rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              Continue to Home
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="animate-item w-full cursor-pointer rounded-xl border border-slate-300 bg-transparent px-5 py-4 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => loginWithProvider("google")}
              className="animate-item flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              <svg className="h-5 w-5 rounded-full bg-white p-0.5 text-blue-600" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("github")}
              className="animate-item flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-4 font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("apple")}
              className="animate-item flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-4 font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 384 512">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 22.1 184 6.7 241A384 384 0 000 379.7c1 19.3 5.4 39.7 13 60 17.2 44.9 50.2 88.3 89.3 90 22.3 1 37.8-13 62.7-13 24.3 0 38.3 13.5 61.6 13.5 39.9-1.5 73.1-46.7 89.6-91.8 19-54 19.6-58.8 20.6-61.9-25.1-13-40.2-39.6-40.2-67.9zM245.8 91.5c17.1-23.4 27.6-53.7 24.5-84.5-24.7 1.3-53 14.8-71.1 35.5-16.1 18-28.5 45.1-25.1 76.9 27.2 2.3 52.6-11.4 71.7-27.9z" />
              </svg>
              Continue with Apple
            </button>

            <div className="animate-item relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700/80"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-950">
                  Or
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/games")}
              className="animate-item group flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-4 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
            >
              <Gamepad2 className="h-5 w-5 transition-transform group-hover:rotate-6 group-hover:scale-110" />
              Play Games as Guest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
