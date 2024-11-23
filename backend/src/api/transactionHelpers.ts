// Types and Interfaces
export interface Transaction {
  id: number;
  posId: string;
  amount: number;
  beneficiary: string;
  bankName: string;
  created_at: Date;
  updated_at: Date;
}

// Constants
export const BANK_NAMES = ['Wema Bank', 'Access Bank', 'Moniepoint MFB', 'GTBank'];
const FIRST_NAMES = ['John', 'Mary', 'James', 'Sarah', 'Michael', 'Elizabeth', 'David', 'Emma'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

// Utility functions
export const getRandomElement = <T>(array: T[]): T =>
  array[Math.floor(Math.random() * array.length)];

export const generateBeneficiaryName = (): string =>
  `${getRandomElement(FIRST_NAMES)} ${getRandomElement(LAST_NAMES)}`;

export const isValidTransactionInput = (
  id: unknown,
  amount: unknown,
): amount is number => {
  return Boolean(id && typeof amount === 'number' && amount > 0);
};