// Routes that stay locked until a visitor signs in. The navbar blurs the links
// that lead here, and OnboardingGate bounces anyone who types the URL directly
// back to the landing page, so both entry points agree on the same list.
// `/blog` is deliberately absent: it is public marketing content that has to
// stay reachable from search results and shared links.
export const GATED_ROUTES = [
  "/topics",
  "/my-decks",
  "/friends",
  "/leaderboard",
  "/learned-words",
  "/level-test",
];

export function isGatedPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return GATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
