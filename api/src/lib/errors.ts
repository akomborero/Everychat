import type { NextFunction, Request, RequestHandler, Response } from "express";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Express 4 does not catch rejected promises, so wrap every async handler. */
export const ah =
  <P extends Record<string, string> = Record<string, string>>(
    fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler<P> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
