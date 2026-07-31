"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ScanLine } from "lucide-react";
import { normalizeStoredProfileCode } from "../_lib/profile";

interface ScanQrDialogProps {
  onClose: () => void;
}

function extractProfileCode(scannedText: string): string {
  try {
    const url = new URL(scannedText);
    const match = url.pathname.match(/\/friends\/([^/]+)/);
    if (match) {
      return normalizeStoredProfileCode(decodeURIComponent(match[1]));
    }
  } catch {
    // Not a URL — treat the scanned text as a raw profile code.
  }

  return normalizeStoredProfileCode(scannedText);
}

export default function ScanQrDialog({ onClose }: ScanQrDialogProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "unsupported">(
    "starting",
  );

  useEffect(() => {
    let scanner: import("qr-scanner").default | null = null;
    let cancelled = false;

    const start = async () => {
      const { default: QrScanner } = await import("qr-scanner");

      if (cancelled || !videoRef.current) {
        return;
      }

      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setStatus("unsupported");
        return;
      }

      scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const profileCode = extractProfileCode(result.data);
          if (!profileCode) {
            return;
          }
          scanner?.stop();
          onClose();
          router.push(`/friends/${profileCode}`);
        },
        { preferredCamera: "environment", highlightScanRegion: true },
      );

      try {
        await scanner.start();
        if (!cancelled) {
          setStatus("scanning");
        }
      } catch {
        if (!cancelled) {
          setStatus("denied");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [onClose, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-[2.25rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1c141a]">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
            <ScanLine className="h-5 w-5" />
            Scan a friend&apos;s QR
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 dark:border-white/10">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        </div>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {status === "starting" && "Starting camera..."}
          {status === "scanning" && "Point your camera at their profile QR code."}
          {status === "denied" &&
            "Camera access was denied. Allow camera access in your browser settings to scan."}
          {status === "unsupported" && "No camera was found on this device."}
        </p>
      </div>
    </div>
  );
}
