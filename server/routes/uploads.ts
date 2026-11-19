import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';
import { HttpError } from '../lib/validation';

const router = Router();

const ALLOWED_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Documents
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
  // Video
  'video/mp4',
  'video/quicktime', // .mov
  'video/webm',
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/mpeg',
  'video/3gpp',
]);

const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) return cb(new HttpError(400, 'Unsupported file type'));
    cb(null, true);
  },
});

router.post('/', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Multer decodes multipart filenames as latin1; re-decode so non-ASCII names (e.g. Cyrillic) survive.
  const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const fileUrl = await uploadToStorage(req.file.buffer, 'chat-files', fileName);

  res.status(201).json({
    fileUrl,
    fileName,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  });
});

export default router;
