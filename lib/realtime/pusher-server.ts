import Pusher from "pusher";

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER;

if (!appId || !key || !secret || !cluster) {
  throw new Error("Pusher environment variables are required");
}

export const pusher = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});
