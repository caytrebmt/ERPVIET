import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import compression from "compression";
import { shopRouter } from "../../src/api/shopRouter.js";
import { saasRouter } from "../../src/api/saasRouter.js";

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

export const handler = serverless(api);
export default handler;
