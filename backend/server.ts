import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { config } from "./config.js";
import { AppError, errorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routes/api.js";

const app = express();

app.use(helmet());
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
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Resource not found"));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Lumen Academy API running at http://localhost:${config.port}`);
});
