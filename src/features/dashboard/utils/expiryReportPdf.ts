import jsPDF from 'jspdf';
import { formatDate } from '@/lib/utils';
import type { Dealer } from '@/types/database';
import { differenceInDays, parseISO } from 'date-fns';

export const generateExpiryReportPdfBlob = async (
  items: any[],
  dealer: Dealer | null,
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  let yPos = margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38); // red
  doc.setFont('helvetica', 'bold');
  doc.text('EXPIRING MEDICINES REPORT', margin, yPos);

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
  doc.text(`Generated On: ${formatDate(new Date().toISOString())}`, margin, yPos);
  
  yPos += 15;

  // --- Data ---
  if (items.length === 0) {
     doc.text("No expiring medicines found.", margin, yPos);
  } else {
     const cols = [
       { name: 'PRODUCT NAME', width: 80, align: 'left' },
       { name: 'BATCH NO.', width: 30, align: 'left' },
       { name: 'EXPIRY DATE', width: 30, align: 'left' },
       { name: 'QTY LEFT', width: 30, align: 'right' }
     ];

     doc.setFontSize(9);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(0, 0, 0);
     doc.setDrawColor(50, 50, 50);
     doc.line(margin, yPos, pageWidth - margin, yPos);
     yPos += 5;

     let currentX = margin;
     cols.forEach(col => {
       const xPos = col.align === 'right' ? currentX + col.width : currentX;
       doc.text(col.name, xPos, yPos, { align: col.align as any });
       currentX += col.width;
     });

     yPos += 3;
     doc.line(margin, yPos, pageWidth - margin, yPos);
     yPos += 7;

     doc.setFont('helvetica', 'normal');

     items.forEach(item => {
        if (yPos > 270) {
           doc.addPage();
           yPos = margin;
           
           doc.setFont('helvetica', 'bold');
           currentX = margin;
           cols.forEach(col => {
             const xPos = col.align === 'right' ? currentX + col.width : currentX;
             doc.text(col.name, xPos, yPos, { align: col.align as any });
             currentX += col.width;
           });
           yPos += 3;
           doc.line(margin, yPos, pageWidth - margin, yPos);
           yPos += 7;
           doc.setFont('helvetica', 'normal');
        }

        currentX = margin;
        
        const daysLeft = item.expiry_date ? differenceInDays(parseISO(item.expiry_date), new Date()) : 0;
        const isExpired = daysLeft < 0;

        // Name
        doc.setTextColor(isExpired ? 220 : 0, isExpired ? 38 : 0, isExpired ? 38 : 0);
        const nameLines = doc.splitTextToSize(item.product?.name || 'Unknown', cols[0].width - 5);
        doc.text(nameLines, currentX, yPos);
        currentX += cols[0].width;

        // Batch
        doc.setTextColor(100, 100, 100);
        doc.text(item.batch_number || 'N/A', currentX, yPos);
        currentX += cols[1].width;

        // Expiry
        doc.text(item.expiry_date ? formatDate(item.expiry_date) : 'N/A', currentX, yPos);
        currentX += cols[2].width;

        // Qty
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(String(item.remaining_quantity || 0), currentX + cols[3].width, yPos, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        yPos += Math.max(nameLines.length * 5, 8);
        
        doc.setDrawColor(240, 240, 240);
        doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
     });
  }

  // --- Footer ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated report.', pageWidth / 2, 290, { align: 'center' });

  return doc.output('blob');
};

export const shareExpiryReportViaWhatsApp = async (
  items: any[], 
  dealer: Dealer | null
): Promise<void> => {
  const { sharePdfViaWhatsApp } = await import('@/lib/shareUtils');
  const blob = await generateExpiryReportPdfBlob(items, dealer);
  
  const expiredCount = items.filter(item => {
    const daysLeft = item.expiry_date ? differenceInDays(parseISO(item.expiry_date), new Date()) : 0;
    return daysLeft < 0;
  }).length;
  
  const fallbackText = `*${dealer?.shop_name || 'AquaDealers'}*\n-------------------\n*Expiring Medicines Report*\n*Total Items:* ${items.length}\n*Already Expired:* ${expiredCount}\n-------------------\nPlease find the detailed report PDF attached.`;
  
  await sharePdfViaWhatsApp(blob, `Expiry_Report_${new Date().toISOString().split('T')[0]}.pdf`, fallbackText);
};
