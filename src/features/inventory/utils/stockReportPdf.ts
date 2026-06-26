import jsPDF from 'jspdf';
import { formatDate } from '@/lib/utils';
import type { Dealer } from '@/types/database';
import { StockLedgerItem } from '../services/stockReportService';

export const generateStockReportPdfBlob = async (
  items: StockLedgerItem[],
  dealer: Dealer | null,
  startDate: string,
  endDate: string
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  let yPos = margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // blue
  doc.setFont('helvetica', 'bold');
  doc.text('STOCK MOVEMENT REPORT', margin, yPos);

  if (dealer?.shop_name) {
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(dealer.shop_name, pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    let addressLine = '';
    if (dealer.address) addressLine += dealer.address;
    if (dealer.district) addressLine += (addressLine ? ', ' : '') + dealer.district;
    if (dealer.state) addressLine += (addressLine ? ', ' : '') + dealer.state;
    
    if (addressLine) {
       const splitAddress = doc.splitTextToSize(addressLine, 80);
       doc.text(splitAddress, pageWidth - margin, yPos, { align: 'right' });
       yPos += splitAddress.length * 4;
    }
  } else {
    yPos += 6;
  }

  yPos = Math.max(yPos, margin + 15);

  // --- Meta Info ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, margin, yPos);
  
  yPos += 15;

  // --- Data ---
  if (items.length === 0) {
     doc.text("No stock movements found in this period.", margin, yPos);
  } else {
     items.forEach(item => {
        if (yPos > 260) {
           doc.addPage();
           yPos = margin;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        
        // Wrap product name if long
        const nameLines = doc.splitTextToSize(item.productName, pageWidth - 2 * margin - 40);
        doc.text(nameLines, margin, yPos);
        
        doc.setFontSize(12);
        doc.setTextColor(220, 38, 38);
        doc.text(`${item.totalOut} issued`, pageWidth - margin, yPos, { align: 'right' });
        
        yPos += nameLines.length * 5 + 2;

        // Farmers
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        
        // Draw sub table headers
        doc.text('FARMER', margin + 5, yPos);
        doc.text('QTY', pageWidth - margin - 5, yPos, { align: 'right' });
        yPos += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
        yPos += 5;

        item.farmers.forEach(farmer => {
           if (yPos > 275) {
              doc.addPage();
              yPos = margin;
           }
           doc.setTextColor(0, 0, 0);
           const fNameLines = doc.splitTextToSize(farmer.farmerName, pageWidth - 2 * margin - 60);
           doc.text(fNameLines, margin + 5, yPos);
           doc.text(String(farmer.quantity), pageWidth - margin - 5, yPos, { align: 'right' });
           
           yPos += fNameLines.length * 5;
        });
        
        yPos += 5;
     });
  }

  // --- Footer ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated report.', pageWidth / 2, 290, { align: 'center' });

  return doc.output('blob');
};

export const shareStockReportViaWhatsApp = async (
  items: StockLedgerItem[], 
  dealer: Dealer | null,
  startDate: string,
  endDate: string
): Promise<void> => {
  const { sharePdfViaWhatsApp } = await import('@/lib/shareUtils');
  const blob = await generateStockReportPdfBlob(items, dealer, startDate, endDate);
  
  const fallbackText = `*${dealer?.shop_name || 'AquaDealers'}*\n-------------------\n*Stock Movement Report*\n*Period:* ${formatDate(startDate)} to ${formatDate(endDate)}\n*Items Sold:* ${items.length}\n-------------------\nPlease find the detailed report PDF attached.`;
  
  await sharePdfViaWhatsApp(blob, `Stock_Report_${startDate}_to_${endDate}.pdf`, fallbackText);
};

export const downloadStockReportPdf = async (
  items: StockLedgerItem[], 
  dealer: Dealer | null,
  startDate: string,
  endDate: string
): Promise<void> => {
  const blob = await generateStockReportPdfBlob(items, dealer, startDate, endDate);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Stock_Report_${startDate}_to_${endDate}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
