import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate, formatCurrency } from './utils';
import type { Dealer } from '@/types/database';
import { sharePdfViaWhatsApp } from './shareUtils';

export const generateBillPdfBlob = async (bill: any, dealer: Dealer | null): Promise<Blob> => {
  const element = document.getElementById('print-content');
  
  if (!element) {
    throw new Error('Template element not found in the DOM.');
  }

  // Temporarily store original styles to restore them later
  const originalStyle = element.style.cssText;
  
  // Apply a fixed width for A4 size matching our templates (210mm at 96 DPI is ~794px)
  element.style.width = '794px';
  element.style.maxWidth = 'none';

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Better resolution
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    
    // A4 size in mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    return pdf.output('blob');
  } finally {
    // Restore original styles
    element.style.cssText = originalStyle;
  }
};

export const downloadBillPdf = async (bill: any, dealer: Dealer | null): Promise<void> => {
  const blob = await generateBillPdfBlob(bill, dealer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${bill.bill_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const shareBillPdfViaWhatsApp = async (bill: any, dealer: Dealer | null, farmerPhone?: string): Promise<void> => {
  const blob = await generateBillPdfBlob(bill, dealer);
  
  const customerLabel = bill.farmer_name_snapshot || 'Walk-in Customer';
  const fallbackText = `*AquaDealers Invoice*\n-------------------\n*Bill No:* ${bill.bill_number}\n*Date:* ${formatDate(bill.bill_date)}\n*Billed To:* ${customerLabel}\n\n*Total Amount:* ${formatCurrency(bill.total)}\n*Amount Paid:* ${formatCurrency(bill.amount_paid)}\n*Balance Due:* ${formatCurrency(bill.balance_due)}\n-------------------\nThank you for purchasing with us!`;
  
  await sharePdfViaWhatsApp(blob, `Invoice_${bill.bill_number}.pdf`, fallbackText, farmerPhone);
};
