export type LookupResult =
  | { status: 'ok'; word: string; ipa: string }
  | { status: 'not_found' }
  | { status: 'not_paid' };

/** `free`: this build is free, or the user installed it while it was (and so keeps it free). */
export type LicenseStatus = { paid: boolean; key: string | null; free?: 'free_build' | 'early_adopter'; error?: string };

export type Message =
  | { type: 'LOOKUP'; word: string }
  | { type: 'GET_LICENSE' }
  | { type: 'ACTIVATE'; key: string }
  | { type: 'DEACTIVATE' }
  | { type: 'RECOVER'; email: string };
