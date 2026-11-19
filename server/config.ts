import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT) || 4000;

export const config = {
  port,
  jwtSecret: required('JWT_SECRET'),
  isProduction: process.env.NODE_ENV === 'production',

  /** Exact origins allowed to call the API with credentials (comma-separated FRONTEND_URL). */
  allowedOrigins: Array.from(
    new Set([
      'http://localhost:3000',
      ...(process.env.FRONTEND_URL ?? '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ])
  ),

  /** Public base URL of this API, used to build links to locally stored uploads. */
  publicUrl: (process.env.PUBLIC_API_URL || `http://localhost:${port}`).replace(/\/$/, ''),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
