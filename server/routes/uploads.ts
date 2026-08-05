import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { requireAuth,AuthRequest } from '../middleware/auth'
import { error } from 'console';
import { uploadToStorage } from '../lib/storage';

const router = Router();

const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain'
];

const storage = multer.diskStorage({
    destination:(req,file,cb) => {
        cb(null,path.join(__dirname, '../uploads/chat-files'));
    },
    filename: (req:AuthRequest,file,cb) => {
        const ext = path.extname(file.originalname);
        const safeName = `${req.userId}-${Date.now()}${ext}`;
        cb(null,safeName);
    }
});

const upload = multer({
    storage,
    limits:{ fileSize: 1024 * 1024 * 20},
    fileFilter: (req,file,cb) => {
        if(!ALLOWED_TYPES.includes(file.mimetype)) return cb(new Error('Unsupported filetype'));
        cb(null,true)
    }
});

router.post('/', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const properFileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const fileUrl = await uploadToStorage(req.file.buffer, 'chat-files');

    res.status(201).json({
      fileUrl,
      fileName: properFileName,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    });
  } catch (err) {
  console.error('Error uploading avatar:', err);
  res.status(500).json({ error: (err as Error).message || 'Upload failed' });
}
});

export default router;