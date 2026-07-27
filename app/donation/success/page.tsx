import Link from "next/link";
import { Heart } from "lucide-react";

export default function DonationSuccessPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-6 py-16">
      <div className="w-full rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl dark:border-rose-900/70 dark:bg-slate-950 sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <Heart className="h-8 w-8 fill-current" />
        </span>
        <h1 className="mt-6 text-3xl font-black text-slate-900 dark:text-white">
          Thank you for supporting KatchUp!
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Your donation was completed securely through Stripe.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Back to KatchUp
        </Link>
      </div>
    </section>
  );
}
