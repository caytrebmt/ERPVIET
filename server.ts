import express from "express";
import path from "path";
import cors from "cors";
import compression from "compression";
import { shopRouter } from "./src/api/shopRouter.js";
import { saasRouter } from "./src/api/saasRouter.js";
import { autoMigrateDatabase, ensureProductImageSchema, ensureWebOrderSchema, testDbConnection } from "./src/db/index.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Enable HTTP response compression (Gzip/Brotli) for faster network transfers
app.use(compression());

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static assets from public/static with caching headers
const webshopStaticPath = path.join(process.cwd(), "public", "static");
app.use("/static", express.static(webshopStaticPath, {
  maxAge: "7d",
  etag: true,
}));

// Direct Express shop & saas routers
app.use("/api/shop", shopRouter);
app.use("/api/saas", saasRouter);

// --- ĐOẠN CŨ BỊ XÓA Ở ĐÂY ĐỂ TRÁNH LỖI ĐỌC THƯ MỤC DIST KHI CHẠY DEV ---

async function startServer() {
  const connected = await testDbConnection();

  // Run database migrations only when explicitly enabled to avoid overwriting an existing production database.
  // QUAN TRỌNG: migrate TRƯỚC để tạo bảng, rồi mới chỉnh sửa schema — tránh crash trên DB mới (bảng chưa tồn tại).
  const shouldAutoMigrate = process.env.AUTO_MIGRATE_DATABASE === 'true';
  if (connected && shouldAutoMigrate) {
    await autoMigrateDatabase().catch((err) => console.error("[DB Boot Error]", err));
  } else {
    console.log('[Database] Auto migration disabled. Set AUTO_MIGRATE_DATABASE=true to enable schema.sql execution on startup.');
  }

  // Chỉnh lý schema tăng cường (index/ALTER) — bọc try/catch để không làm sập server khi DB mới/DB thiếu bảng.
  if (connected) {
    await ensureProductImageSchema().catch((err) => {
      console.warn("[DB Boot Warning] ensureProductImageSchema failed:", err.message);
    });
    await ensureWebOrderSchema().catch((err) => {
      console.warn("[DB Boot Warning] ensureWebOrderSchema failed:", err.message);
    });
  }

  // Phân chia cấu hình Dev và Production chuẩn xác
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.join(process.cwd(), "vite.config.ts"),
      root: path.join(process.cwd()),
      server: { middlewareMode: true, port: 3000, host: true, allowedHosts: true },
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
