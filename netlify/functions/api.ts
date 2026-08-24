import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import compression from "compression";
import { shopRouter } from "../../src/api/shopRouter.js";
import { saasRouter } from "../../src/api/saasRouter.js";
import { runMigrations, testDbConnection } from "../../src/db/index.js";

// Single Express app reused across warm Lambda invocations. Routes are mounted
// under the original "/api" prefix so the frontend's relative /api/* calls
// keep working behind the Netlify rewrite.
const api = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
api.use(cors({
  origin: allowedOrigins.length
    ? (origin: any, cb: any) => cb(null, !origin || allowedOrigins.includes(origin))
    : true,
  credentials: true,
}));
api.use(compression());
api.use(express.json({ limit: "10mb" }));
api.use(express.urlencoded({ limit: "10mb", extended: true }));

api.use("/api/shop", shopRouter);
api.use("/api/saas", saasRouter);

const baseHandler = serverless(api);

// The Netlify Function is a cold-start Lambda wrapper. `src/db/index.ts` only
// flips `isConnected = true` inside `testDbConnection()`; server.ts calls it
// on boot, but the Function handler did not — so `isDbConnected()` stayed
// false and the tenant middleware could not resolve a real database scope.
// Probe the DB once per cold start so the real connection state is known
// before the first request is served.
let connectionChecked = false;
export const handler = async (event: any, context: any): Promise<any> => {
  if (!connectionChecked) {
    connectionChecked = true;
    const ok = await testDbConnection().catch((err: any) => {
      console.warn("[Function] Supabase connection check failed:", err?.message ?? err);
      return false;
    });
    console.log(`[Function] Supabase database connected: ${ok}`);
    if (ok) {
      await runMigrations().catch((err: any) =>
        console.warn("[Function] runMigrations failed:", err?.message ?? err)
      );
    }
  }
  return baseHandler(event, context);
};

export default handler;
