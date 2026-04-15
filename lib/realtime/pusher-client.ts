"use client";

import Pusher from "pusher-js";

const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const pusherClient =
  key && cluster
    ? new Pusher(key, {
        cluster,
        forceTLS: true,
      })
    : null;
