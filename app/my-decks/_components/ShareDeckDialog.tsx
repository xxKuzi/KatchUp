"use client";

// Owner-facing sharing controls for one custom deck: the link, what it grants,
// and who has joined. Sharing is live, so this dialog is also the only place a
// deck's access can be taken away again.

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  buildShareUrl,
  fetchShareState,
  removeMember,
  revokeShareLink,
  saveShareLink,
  updateMemberRole,
  type DeckMember,
  type ShareLink,
  type ShareRole,
} from "../_lib/shareClient";

interface ShareDeckDialogProps {
  deckId: string;
  deckName: string;
  onClose: () => void;
}

export default function ShareDeckDialog({
  deckId,
  deckName,
  onClose,
}: ShareDeckDialogProps) {
  const { t } = useLanguage();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [members, setMembers] = useState<DeckMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  const shareUrl = share ? buildShareUrl(share.code) : "";

  const load = useCallback(async () => {
    try {
      const data = await fetchShareState(deckId);
      setShare(data.share);
      setMembers(data.members);
    } catch {
      setError(t("share.loadFailed", "Could not load sharing settings."));
    } finally {
      setLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!shareUrl) {
      setQrCodeDataUrl("");
      return;
    }

    let active = true;
    QRCode.toDataURL(shareUrl, { width: 300, margin: 1 })
      .then((dataUrl) => {
        if (active) setQrCodeDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrCodeDataUrl("");
      });

    return () => {
      active = false;
    };
  }, [shareUrl]);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("share.actionFailed", "Something went wrong."),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (role: ShareRole) =>
    runAction(async () => {
      setShare(await saveShareLink(deckId, role));
    });

  const handleRevoke = () =>
    runAction(async () => {
      await revokeShareLink(deckId);
      setShare(null);
    });

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("share.copyFailed", "Copy the link manually."));
    }
  };

  const handleShareSheet = async () => {
    if (!shareUrl || typeof navigator.share !== "function") {
      void handleCopy();
      return;
    }
    try {
      await navigator.share({ title: deckName, url: shareUrl });
    } catch {
      // Cancelling the OS share sheet is not an error worth showing.
    }
  };

  const handleMemberRole = (member: DeckMember, role: ShareRole) =>
    runAction(async () => {
      await updateMemberRole(deckId, member.userId, role);
      setMembers((current) =>
        current.map((row) =>
          row.userId === member.userId ? { ...row, role } : row,
        ),
      );
    });

  const handleRemoveMember = (member: DeckMember) =>
    runAction(async () => {
      await removeMember(deckId, member.userId);
      setMembers((current) =>
        current.filter((row) => row.userId !== member.userId),
      );
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("share.title", "Share deck")}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t("share.title", "Share deck")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {deckName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {t("common.close", "Close")}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            {t("common.loading", "Loading…")}
          </p>
        ) : !share ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t(
                "share.explainer",
                "Friends who open the link practise this deck live — words you add later show up for them too.",
              )}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCreate("viewer")}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {t("share.createViewLink", "Create link (view only)")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCreate("editor")}
              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              {t("share.createEditLink", "Create link (friends can edit)")}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {qrCodeDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodeDataUrl}
                  alt={t("share.qrAlt", "QR code for this deck")}
                  className="h-28 w-28 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800"
                />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    {copied
                      ? t("share.copied", "Copied!")
                      : t("share.copyLink", "Copy link")}
                  </button>
                  <button
                    type="button"
                    onClick={handleShareSheet}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("share.send", "Send")}
                  </button>
                </div>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("share.linkGrants", "People with the link can")}
              </legend>
              {(["viewer", "editor"] as ShareRole[]).map((role) => (
                <label
                  key={role}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <input
                    type="radio"
                    name="share-role"
                    className="mt-1"
                    checked={share.role === role}
                    disabled={busy}
                    onChange={() => handleCreate(role)}
                  />
                  <span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {role === "viewer"
                        ? t("share.roleViewer", "Practise only")
                        : t("share.roleEditor", "Practise and edit words")}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {role === "viewer"
                        ? t(
                            "share.roleViewerHint",
                            "They see your words and can practise them.",
                          )
                        : t(
                            "share.roleEditorHint",
                            "They can add, change and remove words in this deck.",
                          )}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("share.peopleWithAccess", "People with access")}
              </h3>
              {members.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t("share.noMembers", "Nobody has joined yet.")}
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {member.name ?? t("share.someone", "Someone")}
                      </span>
                      <span className="flex items-center gap-2">
                        <select
                          value={member.role}
                          disabled={busy}
                          onChange={(event) =>
                            handleMemberRole(
                              member,
                              event.target.value as ShareRole,
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="viewer">
                            {t("share.roleViewerShort", "Can practise")}
                          </option>
                          <option value="editor">
                            {t("share.roleEditorShort", "Can edit")}
                          </option>
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRemoveMember(member)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          {t("share.remove", "Remove")}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleRevoke}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("share.revoke", "Turn the link off")}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                "share.revokeHint",
                "The link stops working. People who already joined keep access until you remove them.",
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
