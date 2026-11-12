import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logError } from "../lib/logger";
import { captureError } from "../lib/monitoring";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Invalid input", details: err.flatten().fieldErrors });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (10 MB maximum)" : "Upload failed";
    return res.status(400).json({ error: msg });
  }
  logError("Unhandled request error", err);
  captureError(err);
  res.status(500).json({ error: "Something went wrong on our side" });
};
