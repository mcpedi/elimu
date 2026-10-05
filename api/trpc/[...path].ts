import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";

type AppFactory = () => Express;
let app: Express | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!app) {
      const module = (await import("../../server/vercel-app")) as { createApp: AppFactory };
      app = module.createApp();
    }
    return app(req as never, res as never);
  } catch (error) {
    console.error("[Vercel tRPC] handler failed", error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: "The API could not be started. Check the Vercel function logs." } });
    }
  }
}
