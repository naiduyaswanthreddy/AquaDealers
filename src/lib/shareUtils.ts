/**
 * @deprecated Use whatsAppService.ts directly for new code.
 * This file is kept for backward compatibility with older imports.
 */
export { sharePdfViaWhatsApp, normalizeIndianPhone } from './whatsAppService';

export const canShareFiles = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.canShare === 'function' &&
  typeof File !== 'undefined';
