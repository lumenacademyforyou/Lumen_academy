import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiRouter from "./routes/api";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mount API Router
  app.use("/api", apiRouter);

  // Vite Middleware for development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lumen Academy Full-Stack Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start backend server:", err);
});
