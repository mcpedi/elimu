import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../../server/vercel-app";

let app: ReturnType<typeof createApp> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    app ??= createApp();
    return app(req as never, res as never);
  } catch (error) {
    console.error("[Vercel tRPC] handler failed", error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: "The API could not be started. Check the Vercel server logs." } });
    }
  }
}
