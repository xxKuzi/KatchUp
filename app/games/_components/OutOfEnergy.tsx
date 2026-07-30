"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/_lib/languageContext";
import { useResetCountdown } from "@/app/_lib/energy";
import WatchAdButton from "@/app/_components/WatchAdButton";
import DeckMessage from "./DeckMessage";

interface OutOfEnergyProps {
  /** The game's own hero copy, so the block looks like part of the game. */
  name: string;
  description: string;
  bgImage: string;
}

/**
 * Shown in place of a round when the day's energy is spent. It always offers
 * the way back out — the practice round pays energy — alongside the time left
 * until the refill.
 */
export default function OutOfEnergy(props: OutOfEnergyProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { hours, minutes } = useResetCountdown();

  return (
    <DeckMessage
      name={props.name}
      description={props.description}
      bgImage={props.bgImage}
      title={t("energyGate.title")}
      body={`${t("energyGate.body")} ${t("navbar.resetsIn")} ${hours}h ${minutes}m.`}
      action={{
        label: t("navbar.earnEnergy"),
        onClick: () => router.push("/games/speed-spelling?energyReview=1"),
      }}
      backHref="/games"
      backLabel={t("energyGate.backToGames")}
      // The other way out. Once the ad pays, the gate lifts on its own — the
      // block reads live energy — so the player lands back in the round.
      extra={<WatchAdButton />}
    />
  );
}
