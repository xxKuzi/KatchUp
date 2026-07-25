"use client";

import Pusher from "pusher-js";

const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

// Constructed only in the browser: Next.js still evaluates "use client"
// modules while server-rendering, and there pusher-js resolves to its node
// build whose default export isn't a constructor.
export const pusherClient =
  typeof window !== "undefined" && key && cluster
    ? new Pusher(key, {
        cluster,
        forceTLS: true,
      })
    : null;
