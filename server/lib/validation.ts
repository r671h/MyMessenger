export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,32}$/;

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_GROUP_NAME_LENGTH = 64;
export const MAX_BIO_LENGTH = 300;

export interface RegistrationInput {
  email: string;
  username: string;
  password: string;
}

/** Returns normalized registration data or an error message. */
export function validateRegistration(body: unknown): { data?: RegistrationInput; error?: string } {
  const { email, username, password } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    return { error: 'Email, username and password are required' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();

  if (!EMAIL_REGEX.test(normalizedEmail)) return { error: 'Invalid email address' };
  if (!USERNAME_REGEX.test(normalizedUsername)) {
    return { error: 'Username must be 3–32 characters: letters, digits, "_" or "."' };
  }
  if (password.length < 6) return { error: 'Password must be at least 6 characters' };
  if (password.length > 128) return { error: 'Password is too long' };

  return { data: { email: normalizedEmail, username: normalizedUsername, password } };
}

/** Message text must be non-empty after trimming and within the length limit. */
export function normalizeMessageContent(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}

/** Attachment URLs come from the client, so only plain http(s) links are accepted (no javascript: etc.). */
export function isSafeFileUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Parses the multipart `memberIds` field (JSON array of user ids). */
export function parseMemberIds(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new HttpError(400, 'memberIds must be a JSON array');
  }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new HttpError(400, 'memberIds must be an array of user ids');
  }
  return parsed;
}
