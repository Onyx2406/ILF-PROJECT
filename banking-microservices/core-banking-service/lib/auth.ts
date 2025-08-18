import bcrypt from 'bcrypt';

/**
 * Generate a unique username from email and IBAN
 * Format: first part of email + last 4 digits of IBAN + random digits
 */
export function generateUsername(email: string, iban: string): string {
  // Get the part before @ from email
  const emailPart = email.split('@')[0].toLowerCase();
  
  // Get last 4 digits from IBAN
  const ibanPart = iban.slice(-4);
  
  // Generate random 2-digit number
  const randomPart = Math.floor(10 + Math.random() * 90).toString();
  
  // Combine parts and limit to reasonable length
  const username = `${emailPart}${ibanPart}${randomPart}`.substring(0, 20);
  
  return username;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Default password for new accounts
 */
export const DEFAULT_PASSWORD = 'Abcd@1234';
