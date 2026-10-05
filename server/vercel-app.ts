import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function createApp() {
  const app = express();

  // Keep the existing upload limits used by learner documents and school branding.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  const trpcMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
  });
  // Vercel may invoke a catch-all function with either /api/trpc/... or
  // /trpc/... as req.url. Supporting both keeps the same handler portable
  // across Vercel and the standalone Express server.
  app.use(["/api/trpc", "/trpc"], trpcMiddleware);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API] Unhandled request error", error);
    if (!res.headersSent) res.status(500).json({ error: { message: "The server could not complete the request." } });
  });

  return app;
}
