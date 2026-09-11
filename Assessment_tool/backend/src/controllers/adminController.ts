import { Request, Response } from "express";

export const getAdminStats = (_req: Request, res: Response): void => {
  res.json({
    status: "success",
    overview: {
      totalRegisteredStudents: 12480,
      activeTestTakersToday: 1420,
      totalMocksCompleted: 89450,
      averagePlatformScore: 542,
      serverStatus: "Optimal",
      dbLatencyMs: 18,
    },
    recentStudents: [
      { id: "s101", name: "Prince A", target: "NEET 2026", avgScore: 680, status: "Active" },
      { id: "s105", name: "Demo User", target: "NEET 2026", avgScore: 520, status: "Idle" },
    ],
  });
};
