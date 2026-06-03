import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Dealer } from '@/types/database';

const safeCurrency = (val: number) => formatCurrency(val).replace(/₹/g, 'Rs ');

export const generateFarmerStatementPdfBlob = async (
  statement: any,
  dealer: Dealer | null,
  startDate: string,
  endDate: string
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  let yPos = margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const { farmer, openingBalance, totalDebit, totalCredit, closingBalance, transactions } = statement;

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.text('BALANCE STATEMENT', margin, yPos);

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

  // --- Farmer Info & Period ---
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Farmer: ${farmer.name}`, margin, yPos);
  
  if (farmer.phone) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Phone: ${farmer.phone}`, margin, yPos + 6);
  }
  if (farmer.village) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Village: ${farmer.village}`, margin, yPos + (farmer.phone ? 12 : 6));
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, pageWidth - margin, yPos, { align: 'right' });

  yPos += 20;

  // --- Summary Box ---
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Opening Balance', margin + 5, yPos + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(safeCurrency(openingBalance), margin + 5, yPos + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Total Bills', margin + 55, yPos + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38); // red
  doc.text(`+${safeCurrency(totalDebit)}`, margin + 55, yPos + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Total Paid', margin + 105, yPos + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74); // green
  doc.text(`-${safeCurrency(totalCredit)}`, margin + 105, yPos + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Closing Balance', pageWidth - margin - 5, yPos + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138); // blue
  doc.text(safeCurrency(closingBalance), pageWidth - margin - 5, yPos + 15, { align: 'right' });

  yPos += 30;

  // --- Transactions Table ---
  const cols = [
    { name: 'DATE', width: 25, align: 'left' },
    { name: 'REF/DETAILS', width: 65, align: 'left' },
    { name: 'BILL (+)', width: 30, align: 'right' },
    { name: 'PAID (-)', width: 30, align: 'right' },
    { name: 'BALANCE', width: 30, align: 'right' }
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
  
  transactions.forEach((tx: any) => {
    if (yPos > 260) {
      doc.addPage();
      yPos = margin;
      
      // Draw header on new page
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
    
    // Date
    doc.text(formatDate(tx.date), currentX, yPos);
    currentX += cols[0].width;

    // Ref/Details
    const detailsX = currentX;
    doc.text(tx.refNumber, detailsX, yPos);
    currentX += cols[1].width;

    // Bill / Adjustment Amount
    if (tx.type === 'bill' || tx.type === 'adjustment') {
       doc.setTextColor(tx.type === 'adjustment' ? 202 : 220, tx.type === 'adjustment' ? 138 : 38, 38); // slightly different red/orange for adjustment
       doc.text(safeCurrency(tx.amount), currentX + cols[2].width, yPos, { align: 'right' });
    }
    currentX += cols[2].width;

    // Paid Amount
    if (tx.type === 'payment') {
       doc.setTextColor(22, 163, 74);
       doc.text(safeCurrency(tx.amount), currentX + cols[3].width, yPos, { align: 'right' });
    }
    currentX += cols[3].width;

    // Balance
    doc.setTextColor(0, 0, 0);
    doc.text(safeCurrency(tx.runningBalance), currentX + cols[4].width, yPos, { align: 'right' });

    let linesCount = 1;
    
    // Additional Details for bills / adjustments
    if ((tx.type === 'bill' || tx.type === 'adjustment') && tx.items && tx.items.length > 0) {
       doc.setFontSize(8);
       doc.setTextColor(100, 100, 100);
       let detailY = yPos + 5;
       
       tx.items.forEach((item: any) => {
         const detailText = `- ${item.product_name_snapshot} (${item.quantity} x ${safeCurrency(item.unit_price).replace('Rs ', '')})`;
         const wrapped = doc.splitTextToSize(detailText, cols[1].width - 5);
         doc.text(wrapped, detailsX + 2, detailY);
         detailY += wrapped.length * 4;
       });
       
       linesCount += Math.ceil((detailY - yPos) / 5);
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
    }
    
    // Additional Details for payments
    if (tx.type === 'payment' && tx.method) {
       doc.setFontSize(8);
       doc.setTextColor(100, 100, 100);
       doc.text(`- Paid via ${tx.method}`, detailsX + 2, yPos + 5);
       linesCount += 1;
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
    }

    yPos += Math.max(linesCount * 5, 8);
    
    // Light separator
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
  });

  // --- Footer ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated statement.', pageWidth / 2, 290, { align: 'center' });

  return doc.output('blob');
};

export const shareFarmerStatementViaWhatsApp = async (
  statement: any, 
  dealer: Dealer | null, 
  startDate: string, 
  endDate: string
): Promise<void> => {
  const { sharePdfViaWhatsApp } = await import('@/lib/shareUtils');
  const blob = await generateFarmerStatementPdfBlob(statement, dealer, startDate, endDate);
  
  const fallbackText = `*${dealer?.shop_name || 'AquaDealer'}*\n-------------------\n*Balance Statement*\n*Farmer:* ${statement.farmer.name}\n*Period:* ${formatDate(startDate)} to ${formatDate(endDate)}\n\n*Closing Balance:* ${formatCurrency(statement.closingBalance)}\n-------------------\nPlease find the detailed PDF attached.`;
  
  await sharePdfViaWhatsApp(blob, `Statement_${statement.farmer.name.replace(/\s+/g, '_')}.pdf`, fallbackText, statement.farmer.phone || undefined);
};

export const downloadFarmerStatementPdf = async (
  statement: any, 
  dealer: Dealer | null, 
  startDate: string, 
  endDate: string
): Promise<void> => {
  const blob = await generateFarmerStatementPdfBlob(statement, dealer, startDate, endDate);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Statement_${statement.farmer.name.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
