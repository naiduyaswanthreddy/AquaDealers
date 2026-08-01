import { toast } from 'sonner';

/**
 * Normalizes an Indian phone number to exactly 10 digits.
 * Handles: "9876543210", "09876543210", "919876543210", "+919876543210",
 *          "98765 43210", "98765-43210"
 * Returns null if the number is invalid or unrecognizable.
 */
export const normalizeIndianPhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);

  // Last resort: try taking last 10 digits if >= 10 digits
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }

  return null;
};

/**
 * Builds a wa.me URL with optional pre-filled text.
 * If phone is provided and valid, opens a specific chat.
 * Otherwise opens WhatsApp with text only (dealer picks contact).
 */
export const buildWaUrl = (
  phone: string | null | undefined,
  text: string
): string => {
  const encoded = encodeURIComponent(text);
  const normalized = normalizeIndianPhone(phone);
  if (normalized) {
    return `https://wa.me/91${normalized}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
};

/**
 * Opens a WhatsApp chat directly (text message only, no attachment).
 * Returns false if phone is missing and shows a toast.
 */
export const openWhatsAppText = (
  phone: string | null | undefined,
  text: string,
  options?: { requirePhone?: boolean; noPhoneMessage?: string }
): boolean => {
  const normalized = normalizeIndianPhone(phone);

  if (options?.requirePhone && !normalized) {
    toast.error(options.noPhoneMessage || "This farmer doesn't have a WhatsApp number. Add a phone number first.", {
      action: { label: 'OK', onClick: () => {} },
    });
    return false;
  }

  const url = buildWaUrl(normalized, text);
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};

/**
 * Shares a PDF via WhatsApp.
 *
 * Strategy:
 *   - Always opens the farmer's WhatsApp chat directly via wa.me (no share dialog).
 *   - PDF is downloaded silently in the background so the user can attach it from the chat.
 *   - On mobile the file is also shared via the Web Share API when available.
 *
 * Throws on error so callers can show a toast.
 */
export const sharePdfViaWhatsApp = async (
  pdfBlob: Blob,
  filename: string,
  message: string,
  phone?: string | null
): Promise<void> => {
  const normalizedPhone = normalizeIndianPhone(phone);

  // Step 1: Silently download the PDF so the user has it ready to attach.
  const objectUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);

  // Step 2: Open WhatsApp directly to the farmer's chat with message pre-filled.
  // wa.me/91XXXXXXXXXX?text=... opens the specific contact's chat immediately.
  const waUrl = buildWaUrl(normalizedPhone, message);

  // Small delay so the browser processes the download first.
  await new Promise(r => setTimeout(r, 400));
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  // Step 3: Show a context-aware toast.
  if (normalizedPhone) {
    toast.info('PDF downloaded. Attach it in the WhatsApp chat that just opened.', {
      duration: 6000,
    });
  } else {
    toast.info('PDF downloaded. Open WhatsApp, find your contact, and attach the PDF.', {
      duration: 6000,
    });
  }
};

/**
 * Guard helper — call before any WhatsApp action that requires a phone number.
 * Shows a user-friendly toast and returns false if no valid phone is found.
 */
export const requirePhone = (
  phone: string | null | undefined,
  farmerName?: string
): boolean => {
  if (normalizeIndianPhone(phone)) return true;

  toast.error(
    farmerName
      ? `${farmerName} doesn't have a phone number. Add one in their profile to use WhatsApp.`
      : "This farmer doesn't have a phone number. Add one in their profile to use WhatsApp.",
    { duration: 4000 }
  );
  return false;
};
