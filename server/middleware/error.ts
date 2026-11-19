import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/validation';

/** Converts any thrown error into a JSON response with a sensible status code. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return res.status(400).json({ error: message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Already exists' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  console.error(`Unhandled error in ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: 'Something went wrong' });
}
