import express from "express";
import path from "path";
import cors from "cors";
import compression from "compression";
import { shopRouter } from "./src/api/shopRouter.js";
import { saasRouter } from "./src/api/saasRouter.js";
import { autoMigrateDatabase, runMigrations, testDbConnection } from "./src/db/index.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Enable HTTP response compression (Gzip/Brotli) for faster network transfers
app.use(compression());

// CORS: cho phép danh sách origin cấu hình trong CORS_ORIGINS (phân tách bằng dấu phẩy).
// Nếu để trống → mở toàn bộ (phù hợp webshop công khai). Cấu hình domain cụ thể cho SaaS.
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length
    ? (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin))
    : true,
  credentials: true,
}));

// Giới hạn payload để giảm bề mặt DoS (50MB chỉ thực sự cần cho upload ảnh Base64).
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Serve static assets from public/static with caching headers
const webshopStaticPath = path.join(process.cwd(), "public", "static");
app.use("/static", express.static(webshopStaticPath, {
  maxAge: "7d",
  etag: true,
}));

// Locale JSON files (fallback if a client still fetches them). Long cache —
// the app now bundles translations, so this is no longer on the critical path.
const localesPath = path.join(process.cwd(), "public", "locales");
app.use("/locales", express.static(localesPath, {
  maxAge: "1d",
  etag: true,
}));

// Direct Express shop & saas routers
app.use("/api/shop", shopRouter);
app.use("/api/saas", saasRouter);

// --- ĐOẠN CŨ BỊ XÓA Ở ĐÂY ĐỂ TRÁNH LỖI ĐỌC THƯ MỤC DIST KHI CHẠY DEV ---

async function startServer() {
  if (await testDbConnection()) {
    await runMigrations();
  }

  // Run database migrations only when explicitly enabled to avoid overwriting an existing production database.
  const shouldAutoMigrate = process.env.AUTO_MIGRATE_DATABASE === 'true';
  if (shouldAutoMigrate) {
    autoMigrateDatabase().catch((err) => console.error("[DB Boot Error]", err));
  } else {
    console.log('[Database] Auto migration disabled. Set AUTO_MIGRATE_DATABASE=true to enable schema.sql execution on startup.');
  }

  // Phân chia cấu hình Dev và Production chuẩn xác
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.join(process.cwd(), "vite.config.ts"),
      root: path.join(process.cwd()),
      server: { middlewareMode: true, port: 3000, host: true },
      appType: "spa",
    });
    // Trình phục vụ mã nguồn React trực tiếp khi dev (Hot Reload)
    app.use(vite.middlewares); 
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1d",
      etag: true,
    }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
