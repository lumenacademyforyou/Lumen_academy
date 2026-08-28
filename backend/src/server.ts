import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { config } from "./config/env.js";
import { AppError, errorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routes/api.js";

const app = express();

// Real, previously-undetected production defect found live while writing
// Phase F6's Playwright journeys (LA-APP-COMPLETION-001): helmet()'s default
// CSP restricts connect-src/img-src to 'self' only, but auth in this app is
// entirely client-side Supabase (frontend/src/services/supabaseAuth.ts calls
// Supabase's Auth API directly from the browser — there is no backend
// /api/auth/login) and published question images resolve to Supabase
// Storage public URLs (db/content/asset-resolver.ts). Both were silently
// blocked by the browser under the default policy — no server-side error,
// no build warning, just a failed fetch/img load — so sign-in (and any
// image-bearing question) has likely never actually worked against a real
// production build until now. Merges helmet's own safe defaults with the
// one real cross-origin dependency this app has (its own Supabase project),
// rather than disabling CSP outright.
const supabaseOrigin = new URL(config.supabaseUrl).origin;
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": ["'self'", supabaseOrigin],
        "img-src": ["'self'", "data:", supabaseOrigin],
      },
    },
  })
);
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);
app.use("/api", (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Resource not found"));
});

if (config.nodeEnv === "production") {
  // In production this server also serves the built SPA, so "/" must reach
  // index.html, not a JSON stub — the bare-root JSON handler formerly here
  // shadowed the app's actual landing page. Real health checks use GET /api/health.
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // No frontend build to serve outside production — a bare root hit (e.g. a
  // sanity check in a browser) gets a JSON status instead of the generic
  // 404 catch-all below.
  app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Lumen Academy backend is running and healthy." });
  });
}

app.use((_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Resource not found"));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`✔ Lumen Academy API is healthy — running at http://localhost:${config.port}`);
});
