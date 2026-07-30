"use client";

import QRCode from "qrcode";
import { useAuthState } from "@/app/_lib/auth";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  buildProfileUrl,
  friendFromPublicProfile,
  getAvatarBackground,
  type PublicFriendProfile,
} from "../_lib/profile";
import {
  addFriendToState,
  createInitialFriendsLeagueState,
  parseFriendsLeagueState,
} from "../_lib/league";

const LEAGUE_STORAGE_KEY_PREFIX = "katchup-friends-league-v1";

function leagueStorageKey(userKey: string): string {
  return `${LEAGUE_STORAGE_KEY_PREFIX}:${userKey}`;
}

function formatXp(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export default function FriendProfilePage() {
  const params = useParams<{ profileCode?: string | string[] }>();
  const router = useRouter();
  const { isSignedIn, isReady, session } = useAuthState();
  const userKey = session?.user?.email ?? session?.user?.name ?? "player";
  const [profile, setProfile] = useState<PublicFriendProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading profile...");
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending_outgoing" | "pending_incoming" | "friends">("none");
  const [profileUrl, setProfileUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  const profileCode = Array.isArray(params.profileCode)
    ? (params.profileCode[0] ?? "")
    : (params.profileCode ?? "");

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setStatusMessage("Loading profile...");

      const response = await fetch(`/api/friends/profile/${profileCode}`);

      if (!active) {
        return;
      }

      if (!response.ok) {
        setProfile(null);
        setStatusMessage("Profile not found.");
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as PublicFriendProfile;
      setProfile(data);
      setStatusMessage(`${data.nickname} profile is ready.`);
      setIsLoading(false);
    };

    if (profileCode) {
      void loadProfile();
    }

    return () => {
      active = false;
    };
  }, [profileCode]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileUrl(buildProfileUrl(window.location.origin, profile.profileCode));
  }, [profile]);

  useEffect(() => {
    if (!profileUrl) {
      setQrCodeDataUrl("");
      return;
    }

    let active = true;

    const buildQr = async () => {
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
      });

      if (active) {
        setQrCodeDataUrl(dataUrl);
      }
    };

    void buildQr();

    return () => {
      active = false;
    };
  }, [profileUrl]);

  useEffect(() => {
    if (!isReady || !isSignedIn || !profile) {
      return;
    }

    const checkStatus = async () => {
      const response = await fetch("/api/friends").catch(() => null);
      if (response && response.ok) {
        const data = await response.json();
        const normalizedTarget = profile.profileCode.toLowerCase();
        
        const isFriend = (data.friends || []).some(
          (f: any) => f.profileCode?.toLowerCase() === normalizedTarget
        );
        const isOutgoing = (data.outgoingRequests || []).some(
          (r: any) => r.profileCode?.toLowerCase() === normalizedTarget
        );
        const isIncoming = (data.incomingRequests || []).some(
          (r: any) => r.profileCode?.toLowerCase() === normalizedTarget
        );

        if (isFriend) setConnectionStatus("friends");
        else if (isOutgoing) setConnectionStatus("pending_outgoing");
        else if (isIncoming) setConnectionStatus("pending_incoming");
        else setConnectionStatus("none");
      }
    };

    void checkStatus();
  }, [isReady, isSignedIn, profile]);

  const avatarBackground = useMemo(
    () => (profile ? getAvatarBackground(profile.avatarBackgroundId) : null),
    [profile],
  );

  const handleAddFriend = async () => {
    if (!profile) {
      return;
    }

    if (!isSignedIn) {
      router.push("/login");
      return;
    }

    setIsSaving(true);

    if (connectionStatus === "pending_incoming") {
      // Accept incoming friend request
      const response = await fetch("/api/friends/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileCode: profile.profileCode }),
      }).catch(() => null);

      if (response && response.ok) {
        setConnectionStatus("friends");
        setStatusMessage(`You are now friends with ${profile.nickname}!`);
      } else {
        const errData = await response?.json().catch(() => null);
        setStatusMessage(errData?.error ?? "Failed to accept friend request.");
      }
      setIsSaving(false);
    } else {
      // Send a pending friend request
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileCode: profile.profileCode }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (data.status === "accepted") {
          setConnectionStatus("friends");
          setStatusMessage(`You are now friends with ${profile.nickname}!`);
        } else {
          setConnectionStatus("pending_outgoing");
          setStatusMessage(`Friend request sent to ${profile.nickname}.`);
        }
      } else {
        const errData = await response?.json().catch(() => null);
        setStatusMessage(errData?.error ?? "Failed to send request.");
      }
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-4xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          {statusMessage}
        </div>
      </div>
    );
  }

  if (!profile || !avatarBackground) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
        <div className="mx-auto w-full max-w-3xl rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">
            Profile not found
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            The QR code or profile code did not match a saved profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(to_bottom,rgba(248,250,252,1),rgba(241,245,249,1))] px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-5xl rounded-4xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-950/10 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-black/30 sm:p-8">
        <div
          className={`rounded-4xl bg-linear-to-r ${avatarBackground.accent} p-1`}
        >
          <div className="rounded-[1.7rem] bg-white/95 p-6 dark:bg-slate-950/95 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-r ${avatarBackground.accent} text-base font-bold text-white shadow-lg`}
                >
                  {profile.avatarIcon}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Friend profile
                  </p>
                  <h1 className="mt-2 text-4xl font-black text-slate-950 dark:text-white">
                    {profile.nickname}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {avatarBackground.label}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Profile code
                </p>
                <p className="mt-2 text-2xl font-black tracking-[0.2em] text-slate-900 dark:text-slate-100">
                  {profile.profileCode}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "XP", value: formatXp(profile.currentXp) },
                  { label: "League", value: profile.leagueName },
                  { label: "Friends", value: String(profile.friendsCount) },
                  { label: "Matches", value: String(profile.matchesPlayed) },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      {item.value}
                    </p>
                  </div>
                ))}

                <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Status
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {statusMessage}
                  </p>
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleAddFriend}
                    disabled={isSaving || connectionStatus === "friends" || connectionStatus === "pending_outgoing"}
                    className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                  >
                    {connectionStatus === "friends"
                      ? "Friends ✓"
                      : connectionStatus === "pending_outgoing"
                        ? "Request Pending"
                        : connectionStatus === "pending_incoming"
                          ? "Accept Request"
                          : "Add as friend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/friends")}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Back to Friends
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  QR code
                </p>
                <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-950">
                  <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Profile QR code"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Generating QR code...
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Scan the QR code or open the profile link to jump here.
                </p>
                <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
                  {profileUrl}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
