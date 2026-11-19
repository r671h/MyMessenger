import multer from 'multer';
import { HttpError } from './validation';

/** Multer instance for avatars: images only, up to 5 MB, kept in memory until stored. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new HttpError(400, 'Only image files are allowed'));
    }
    cb(null, true);
  },
});
