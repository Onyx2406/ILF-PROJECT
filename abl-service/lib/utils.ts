import { nanoid } from 'nanoid';

export const generateRandomId = (): string => {
  return nanoid(12);
};

export const generateIBAN = (): string => {
  // Generate Pakistani IBAN: PK + 2 check digits + 4 bank code + 16 account number
  const bankCode = 'ABBL'; // Allied Bank Limited code
  const accountNumber = Math.random().toString().slice(2, 18).padStart(16, '0');
  const checkDigits = Math.floor(Math.random() * 90 + 10); // Random 2-digit number
  return `PK${checkDigits}${bankCode}${accountNumber}`;
};

export const formatIBAN = (value: string): string => {
  let formattedValue = value.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (!formattedValue.startsWith('PK')) {
    formattedValue = 'PK' + formattedValue.replace(/^PK/, '');
  }
  return formattedValue;
};

export const formatMobile = (value: string): string => {
  let formattedValue = value.replace(/[^0-9+]/g, '');
  if (!formattedValue.startsWith('+92')) {
    formattedValue = '+92' + formattedValue.replace(/^(\+92|92|0)/, '');
  }
  return formattedValue;
};

export const generateWalletAddress = (customerName: string, randomId: string, iban?: string): string => {
  if (iban) {
    // Use IBAN-based payment pointer: /{IBAN}
    return `https://abl-backend/${iban}`;
  } else {
    // Fallback to name-based if no IBAN provided
    const cleanName = customerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `https://abl-backend/accounts/${cleanName}-${randomId}`;
  }
};

export const validateIBAN = (iban: string): boolean => {
  const ibanRegex = /^PK[0-9]{2}[A-Z]{4}[0-9]{16}$/;
  return ibanRegex.test(iban);
};

export const validateMobile = (mobile: string): boolean => {
  const mobileRegex = /^\+92[0-9]{10}$/;
  return mobileRegex.test(mobile);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
