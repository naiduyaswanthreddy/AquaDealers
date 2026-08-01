import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { formatDate, formatCurrency } from './utils';
import type { Dealer } from '@/types/database';
import { sharePdfViaWhatsApp, normalizeIndianPhone, buildWaUrl } from './whatsAppService';
import { invoiceMessage } from './whatsAppMessages';

/**
 * Captures the invoice template rendered in the DOM and returns a PDF blob.
 *
 * @param bill     - The bill object
 * @param dealer   - The dealer / shop
 * @param elementId - The DOM element ID to capture. Defaults to 'print-content'.
 *                   Pass 'print-content-wrapper' when calling from CheckoutSuccessModal.
 */
export const generateBillPdfBlob = async (
  bill: any,
  dealer: Dealer | null,
  elementId = 'print-content'
): Promise<Blob> => {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(
      `PDF template element '#${elementId}' not found in the DOM. ` +
      `Ensure the invoice template is rendered before sharing.`
    );
  }

  const originalStyle = element.style.cssText;

  // Force A4-equivalent width so the template renders at the correct scale
  element.style.width = '794px';
  element.style.maxWidth = 'none';

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      skipFonts: false,
    });

    const imgProps = new Image();
    imgProps.src = dataUrl;
    
    // Wait for image to load to get dimensions if needed, though jsPDF handles dataURLs directly
    await new Promise((resolve) => {
      imgProps.onload = resolve;
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

    return pdf.output('blob');
  } finally {
    element.style.cssText = originalStyle;
  }
};

export const downloadBillPdf = async (
  bill: any,
  dealer: Dealer | null,
  elementId = 'print-content'
): Promise<void> => {
  const blob = await generateBillPdfBlob(bill, dealer, elementId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${bill.bill_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const shareBillPdfViaWhatsApp = async (
  bill: any,
  dealer: Dealer | null,
  farmerPhone?: string,
  elementId = 'print-content'
): Promise<void> => {
  const blob = await generateBillPdfBlob(bill, dealer, elementId);

  const shopName = dealer?.shop_name || 'AquaDealers';
  const farmerName = bill.farmer_name_snapshot || null;

  const message = invoiceMessage(
    farmerName,
    bill.bill_number,
    bill.bill_date,
    bill.total,
    bill.amount_paid,
    bill.balance_due,
    shopName
  );

  await sharePdfViaWhatsApp(
    blob,
    `Invoice_${bill.bill_number}.pdf`,
    message,
    farmerPhone
  );
};

/**
 * Captures the invoice template as a PNG and shares it via WhatsApp.
 *
 * If the browser supports Web Share API with files (mobile AND desktop Chrome/Edge
 * on Windows), the native share sheet opens — image + message go directly to
 * WhatsApp in one click, no Ctrl+V needed.
 *
 * Fallback (Firefox, older browsers): image is copied to clipboard and the
 * farmer's WhatsApp chat is opened; the user pastes (Ctrl+V) to send.
 *
 * Throws on error so the caller can show a toast.
 */
export const shareInvoiceImageViaWhatsApp = async (
  bill: any,
  dealer: Dealer | null,
  elementId: string,
  phone?: string | null
): Promise<void> => {
  const { toast } = await import('sonner');

  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Invoice element '#${elementId}' not found in DOM`);

  const shopName = dealer?.shop_name || 'AquaDealers';
  const farmerName = bill.farmer_name_snapshot || (bill as any).farmers?.name || null;
  const billDate = bill.bill_date ?? '';

  const message = invoiceMessage(
    farmerName,
    bill.bill_number,
    billDate,
    bill.total ?? 0,
    bill.amount_paid ?? 0,
    bill.balance_due ?? 0,
    shopName
  );

  const originalStyle = element.style.cssText;
  element.style.width = '794px';
  element.style.maxWidth = 'none';

  let dataUrl: string;
  try {
    dataUrl = await toPng(element, { pixelRatio: 2, skipFonts: false });
  } finally {
    element.style.cssText = originalStyle;
  }

  const res = await fetch(dataUrl);
  const imageBlob = await res.blob();
  const imageFile = new File([imageBlob], `Invoice_${bill.bill_number}.png`, { type: 'image/png' });

  // Web Share API with files works on mobile AND on desktop Chrome/Edge (Windows).
  // When available, the native share sheet opens — image + message go to WhatsApp
  // in one click with no clipboard paste needed.
  if (navigator.canShare?.({ files: [imageFile] })) {
    await navigator.share({ files: [imageFile], text: message });
    return;
  }

  // Fallback for Firefox / older browsers: copy image to clipboard, open chat.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]);

  const normalized = normalizeIndianPhone(phone);
  const waUrl = normalized
    ? `https://wa.me/91${normalized}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  await new Promise(r => setTimeout(r, 300));
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  toast.success(
    normalized
      ? 'Invoice image copied! Press Ctrl+V in the WhatsApp chat to paste and send it.'
      : 'Invoice image copied! Open WhatsApp, find your contact, and press Ctrl+V to send.',
    { duration: 10000 }
  );
};
