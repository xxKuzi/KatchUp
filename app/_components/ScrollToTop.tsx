"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Puts every route change at the top of the page.
 *
 * The router is supposed to do this on its own, but it gives up whenever
 * something re-anchors the viewport while the new page is settling in — a
 * fetch that grows the page, an element taking focus — and the visitor lands
 * mid-page at the offset they had left behind on the page before.
 *
 * Back and forward are left alone: returning to a page you had scrolled
 * through should put you back where you were, which is the one case where
 * keeping the old offset is the point.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const restoring = useRef(false);

  useEffect(() => {
    const markRestoring = () => {
      restoring.current = true;
    };

    window.addEventListener("popstate", markRestoring);
    return () => window.removeEventListener("popstate", markRestoring);
  }, []);

  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
