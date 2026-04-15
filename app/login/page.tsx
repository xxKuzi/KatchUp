"use client";

import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";

  const loginWithProvider = async (provider: "google" | "github" | "apple") => {
    await signIn(provider, { callbackUrl: "/" });
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Login / Register
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use one of the providers below to continue.
        </p>

        {isSignedIn ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Signed in as {session?.user?.name || session?.user?.email || "user"}
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              Continue to Home
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => loginWithProvider("google")}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("github")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("apple")}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Continue with Apple
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
