// Routes that stay locked until a visitor signs in. The navbar blurs the links
// that lead here, and OnboardingGate bounces anyone who types the URL directly
// back to the landing page, so both entry points agree on the same list.
// `/blog` is deliberately absent: it is public marketing content that has to
// stay reachable from search results and shared links.
//
// `/games` is on the list because the setup prompt is now mandatory, and a
// prompt anyone can walk past by typing a URL is not one. `/level-test` has come
// off it for the same reason pointed the other way: the placement test is the
// first thing a visitor does, so it has to be reachable without an account.
export const GATED_ROUTES = [
  "/games",
  "/topics",
  "/my-decks",
  "/friends",
  "/leaderboard",
  "/learned-words",
];

export function isGatedPath(pathname: string | null) {
  return matchesRoute(GATED_ROUTES, pathname);
}

// The pages the setup prompt may not cover: the two ways through it — the test
// it is asking for and the sign-in it offers — plus the offline fallback, where
// a prompt that needs the network to answer would be a dead end.
const SETUP_EXEMPT_ROUTES = ["/level-test", "/login", "/offline"];

// Everything above, plus what a visitor is allowed to read before being asked
// anything. The landing page has to stay legible to someone deciding whether to
// start at all — a dialog thrown over the pitch itself is how you lose the
// people it is written for — and the blog is public marketing besides. Once
// they press Start playing, the prompt is put and it stays put.
const VISITOR_PUBLIC_ROUTES = [...SETUP_EXEMPT_ROUTES, "/", "/blog"];

/** Whether the setup prompt is allowed to open over this path at all. */
export function isSetupExemptPath(pathname: string | null) {
  return matchesRoute(SETUP_EXEMPT_ROUTES, pathname);
}

/** Whether a signed-out visitor gets to read this path before being asked. */
export function isVisitorPublicPath(pathname: string | null) {
  return matchesRoute(VISITOR_PUBLIC_ROUTES, pathname);
}

function matchesRoute(routes: string[], pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
