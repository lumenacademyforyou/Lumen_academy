import { Request, Response } from "express";
import { INITIAL_ATTEMPTS, SYLLABUS_UNITS } from "../../database_sample";

export const getAnalytics = (_req: Request, res: Response): void => {
  res.json({
    status: "success",
    attempts: INITIAL_ATTEMPTS,
    latestProjectedRank: "AIR 140",
    averageAccuracy: "88%",
  });
};

export const getSyllabus = (_req: Request, res: Response): void => {
  res.json({ status: "success", units: SYLLABUS_UNITS });
};
