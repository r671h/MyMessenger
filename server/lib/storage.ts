import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { config } from '../config';

/** Local uploads live next to the process so they can be mounted as a Docker volume. */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const { cloudName, apiKey, apiSecret } = config.cloudinary;
export const usingCloudinary = Boolean(cloudName && apiKey && apiSecret);

if (usingCloudinary) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' }, // 'auto' handles images, video, PDFs, zips, etc.
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'));
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

async function uploadToDisk(buffer: Buffer, folder: string, originalName: string): Promise<string> {
  // Never trust the client-provided name: keep only a short alphanumeric extension.
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  const fileName = `${randomUUID()}${ext}`;
  const dir = path.join(LOCAL_UPLOAD_DIR, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return `${config.publicUrl}/uploads/${folder}/${fileName}`;
}

/**
 * Stores a file and returns its public URL.
 * Uses Cloudinary when credentials are configured, otherwise falls back to local disk
 * so the project runs out of the box without third-party accounts.
 */
export function uploadToStorage(buffer: Buffer, folder: string, originalName = ''): Promise<string> {
  return usingCloudinary ? uploadToCloudinary(buffer, folder) : uploadToDisk(buffer, folder, originalName);
}
