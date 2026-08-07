import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import compression from "compression";
import { shopRouter } from "../../src/api/shopRouter.js";
import { saasRouter } from "../../src/api/saasRouter.js";
import { testDbConnection } from "../../src/db/index.js";

// Single Express app reused across warm Lambda invocations. Routes are mounted
// under the original "/api" prefix so the frontend's relative /api/* calls
// keep working behind the Netlify rewrite.
const api = express();

api.use(cors());
api.use(compression());
api.use(express.json({ limit: "50mb" }));
api.use(express.urlencoded({ limit: "50mb", extended: true }));

api.use("/api/shop", shopRouter);
api.use("/api/saas", saasRouter);

const baseHandler = serverless(api);

// The Netlify Function is a cold-start Lambda wrapper. `src/db/index.ts` only
// flips `isConnected = true` inside `testDbConnection()`; server.ts calls it
// on boot, but the Function handler did not — so `isDbConnected()` stayed
// false and every SaaS route silently served DEMO data instead of Supabase.
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
  }
  return baseHandler(event, context);
};

export default handler;
