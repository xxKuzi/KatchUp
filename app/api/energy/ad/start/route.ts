import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ENERGY_AD_REWARD,
  MAX_DAILY_AD_ENERGY,
} from "@/app/_lib/energyConstants";
import { issueAdTicket, remainingAdAllowance } from "../../_lib/store";

/**
 * Ask permission to play a rewarded video, and get the ticket the reward will
 * be claimed with.
 * POST /api/energy/ad/start
 *
 * Called before the player is shown an ad, so a player who has already used up
 * the day's videos is turned away before an advertiser pays for an impression
 * that could never have been rewarded.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const remaining = await remainingAdAllowance(session.user.id);
  if (remaining < ENERGY_AD_REWARD) {
    return NextResponse.json(
      { error: "Daily ad limit reached", remaining, dailyMax: MAX_DAILY_AD_ENERGY },
      { status: 429 },
    );
  }

  const ticket = await issueAdTicket(session.user.id);

  return NextResponse.json({
    ticket,
    reward: ENERGY_AD_REWARD,
    remaining,
    dailyMax: MAX_DAILY_AD_ENERGY,
  });
}
