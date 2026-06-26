import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Dealer } from '@/types/database';

import { format } from 'date-fns';

const safeCurrency = (val: number) => formatCurrency(val).replace(/₹/g, 'Rs ');

export const generateFarmerStatementPdfBlob = async (
  statement: any,
  dealer: Dealer | null,
  startDate: string,
  endDate: string
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 15;
  let yPos = margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * margin;
  const { farmer, openingBalance, totalDebit, totalCredit, closingBalance, transactions } = statement;

  // Colors based on modern design
  const colors = {
    navy: [11, 23, 61], // #0B173D
    red: [220, 38, 38], // #DC2626
    green: [22, 163, 74], // #16A34A
    blue: [37, 99, 235], // #2563EB
    grayText: [100, 100, 100],
    lightGray: [240, 240, 240],
    borderGray: [226, 232, 240], // slate-200
    bgRed: [254, 242, 242], // red-50
    borderRed: [254, 202, 202], // red-200
  };

  // Helper for text formatting
  const addText = (text: string, x: number, y: number, size: number, color: number[], isBold = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(text, x, y, { align });
  };

  // --- HEADER SECTION ---
  // Left: AQUADEALER -> BALANCE STATEMENT -> Farmer Details
  addText('AQUADEALER', margin, yPos, 10, colors.navy, false);
  yPos += 8;
  addText('BALANCE STATEMENT', margin, yPos, 22, colors.navy, true);
  
  yPos += 12;
  addText('Farmer', margin, yPos, 9, colors.grayText);
  yPos += 5;
  addText(farmer.name, margin, yPos, 12, [0, 0, 0], true);
  yPos += 5;
  addText(`Phone: ${farmer.phone || 'N/A'}`, margin, yPos, 9, [0, 0, 0]);
  yPos += 5;
  addText(`Village: ${farmer.village || 'N/A'}`, margin, yPos, 9, [0, 0, 0]);

  // Right: Shop Details & Period
  let rightY = margin + 4; // Align roughly with BALANCE STATEMENT
  addText(dealer?.shop_name || 'Dealer', pageWidth - margin, rightY, 14, [0, 0, 0], true, 'right');
  rightY += 5;
  
  let addressLine = '';
  if (dealer?.address) addressLine += dealer.address;
  if (dealer?.district) addressLine += (addressLine ? ', ' : '') + dealer.district;
  if (dealer?.state) addressLine += (addressLine ? ', ' : '') + dealer.state;
  
  if (addressLine) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    const splitAddress = doc.splitTextToSize(addressLine, 70);
    doc.text(splitAddress, pageWidth - margin, rightY, { align: 'right' });
    rightY += splitAddress.length * 4.5;
  }
  
  rightY += 4;
  addText(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, pageWidth - margin, rightY, 9, [0, 0, 0], true, 'right');
  rightY += 5;
  addText(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, pageWidth - margin, rightY, 9, colors.grayText, false, 'right');

  yPos = Math.max(yPos, rightY) + 12;

  // Horizontal line
  doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // --- SUMMARY CARDS (4 Columns) ---
  const cardWidth = (contentWidth - 9) / 4; // 3 gaps of 3mm
  const cardHeight = 24;

  const billCount = transactions.filter((t: any) => t.type === 'bill' || t.type === 'adjustment').length;
  const paymentCount = transactions.filter((t: any) => t.type === 'payment').length;

  const cards = [
    { label: 'OPENING BALANCE', value: openingBalance, countText: `as on ${format(new Date(startDate), 'dd MMM yyyy')}`, color: colors.navy },
    { label: 'TOTAL BILLS', value: totalDebit, countText: `${billCount} bills`, color: colors.red },
    { label: 'TOTAL PAID', value: totalCredit, countText: `${paymentCount} payment${paymentCount !== 1 ? 's' : ''}`, color: colors.green },
    { label: 'CLOSING BALANCE', value: closingBalance, countText: `as on ${format(new Date(endDate), 'dd MMM yyyy')}`, color: colors.blue }
  ];

  cards.forEach((card, i) => {
    const x = margin + i * (cardWidth + 3);
    // Draw card border
    doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, yPos, cardWidth, cardHeight, 'FD');
    
    // Label
    addText(card.label, x + cardWidth / 2, yPos + 6, 8, colors.navy, false, 'center');
    // Value
    addText(safeCurrency(card.value), x + cardWidth / 2, yPos + 15, 15, card.color, true, 'center');
    // Subtext
    addText(card.countText, x + cardWidth / 2, yPos + 21, 8, colors.grayText, false, 'center');
  });

  yPos += cardHeight + 8;

  // --- CURRENT OUTSTANDING BANNER ---
  doc.setDrawColor(colors.borderRed[0], colors.borderRed[1], colors.borderRed[2]);
  doc.setFillColor(colors.bgRed[0], colors.bgRed[1], colors.bgRed[2]);
  doc.rect(margin, yPos, contentWidth, 20, 'FD');
  
  addText('CURRENT OUTSTANDING', margin + 5, yPos + 8, 11, colors.red, true);
  addText('Amount due from the farmer', margin + 5, yPos + 14, 9, [0, 0, 0], false);
  addText(safeCurrency(closingBalance), pageWidth - margin - 5, yPos + 12, 22, colors.red, true, 'right');

  yPos += 28;

  // --- TRANSACTION HISTORY TABLE ---
  doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  doc.setFillColor(255, 255, 255);
  
  let tableStartY = yPos;
  
  addText('TRANSACTION HISTORY', margin + 5, yPos + 8, 11, colors.navy, true);
  yPos += 14;

  const cols = [
    { name: 'DATE', width: 35, align: 'left' },
    { name: 'REF / DETAILS', width: 75, align: 'left' },
    { name: 'BILL (+)', width: 25, align: 'right' },
    { name: 'PAID (-)', width: 25, align: 'right' },
    { name: 'BALANCE', width: 20, align: 'right' }
  ];

  let currentX = margin + 5;
  cols.forEach(col => {
    const xPos = col.align === 'right' ? currentX + col.width : currentX;
    addText(col.name, xPos, yPos, 9, [0, 0, 0], true, col.align as any);
    currentX += col.width;
  });

  yPos += 3;
  doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  doc.setLineWidth(0.2);
  doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
  yPos += 7;

  let txCount = 0;
  
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin - 25) {
       // Draw bottom of current box
       doc.line(margin, tableStartY, margin, yPos); // left
       doc.line(pageWidth - margin, tableStartY, pageWidth - margin, yPos); // right
       doc.line(margin, yPos, pageWidth - margin, yPos); // bottom
       
       doc.addPage();
       yPos = margin;
       tableStartY = margin;
       
       // Re-draw headers
       addText('TRANSACTION HISTORY (Cont.)', margin + 5, yPos + 8, 11, colors.navy, true);
       yPos += 14;
       let curX = margin + 5;
       cols.forEach(col => {
         const xPos = col.align === 'right' ? curX + col.width : curX;
         addText(col.name, xPos, yPos, 9, [0, 0, 0], true, col.align as any);
         curX += col.width;
       });
       yPos += 3;
       doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
       yPos += 7;
    }
  };

  transactions.forEach((tx: any, index: number) => {
    let linesRequired = 2; // basic row
    if ((tx.type === 'bill' || tx.type === 'adjustment') && tx.items) {
      linesRequired += tx.items.length;
    }
    if (tx.type === 'payment' && tx.method) {
      linesRequired += 1;
    }
    checkPageBreak(linesRequired * 5 + 10);
    
    currentX = margin + 5;
    
    const txDate = new Date(tx.date);
    
    // DATE COLUMN (Vertical block)
    addText(format(txDate, 'dd'), currentX + 8, yPos, 16, colors.navy, true, 'center');
    addText(format(txDate, 'MMM yyyy'), currentX + 8, yPos + 5, 8, colors.navy, false, 'center');
    addText(format(txDate, 'hh:mm a'), currentX + 8, yPos + 9, 8, colors.navy, false, 'center');
    
    // Vertical Separator
    doc.setDrawColor(230, 230, 230);
    doc.line(currentX + 25, yPos - 4, currentX + 25, yPos + 12);
    
    currentX += cols[0].width;

    // REF / DETAILS
    const detailsX = currentX;
    addText(tx.refNumber + (tx.is_edited ? ' *(Edited)' : ''), detailsX, yPos, 9, [0, 0, 0], true);
    currentX += cols[1].width;

    // BILL (+)
    if (tx.type === 'bill' || tx.type === 'adjustment') {
       addText(safeCurrency(tx.amount), currentX + cols[2].width, yPos, 9, colors.red, true, 'right');
    } else {
       addText('-', currentX + cols[2].width, yPos, 9, [0, 0, 0], true, 'right');
    }
    currentX += cols[2].width;

    // PAID (-)
    if (tx.type === 'payment') {
       addText(safeCurrency(tx.amount), currentX + cols[3].width, yPos, 9, colors.green, true, 'right');
    } else {
       addText('-', currentX + cols[3].width, yPos, 9, [0, 0, 0], true, 'right');
    }
    currentX += cols[3].width;

    // BALANCE
    addText(safeCurrency(tx.runningBalance), currentX + cols[4].width, yPos, 9, [0, 0, 0], true, 'right');

    // Details below REF
    let detailY = yPos + 5;
    
    if ((tx.type === 'bill' || tx.type === 'adjustment') && tx.items && tx.items.length > 0) {
       tx.items.forEach((item: any) => {
         addText(item.product_name_snapshot, detailsX, detailY, 8, colors.grayText);
         addText(`(${item.quantity} x ${safeCurrency(item.unit_price).replace('Rs ', '')})`, detailsX + 30, detailY, 8, colors.grayText);
         addText(safeCurrency(item.unit_price * item.quantity), detailsX + 65, detailY, 8, colors.grayText, false, 'right');
         detailY += 4.5;
       });
    }
    
    if (tx.type === 'payment' && tx.method) {
       addText(`Paid via ${tx.method}`, detailsX, detailY, 8, colors.grayText);
       detailY += 4.5;
    }
    
    yPos = Math.max(yPos + 15, detailY + 2);
    
    txCount++;
    
    if (index < transactions.length - 1) {
      doc.setLineDashPattern([1, 1], 0);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
      doc.setLineDashPattern([], 0);
      yPos += 7;
    }
  });

  yPos += 4;
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
  yPos += 8;
  addText(`Total Transactions: ${txCount}`, margin + 5, yPos, 10, [0, 0, 0], true);
  yPos += 6;

  // Draw the outer box for Transaction History
  doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
  doc.rect(margin, tableStartY, contentWidth, yPos - tableStartY);
  yPos += 10;

  // --- PAYMENT SUMMARY FOOTER ---
  checkPageBreak(25);
  doc.rect(margin, yPos, contentWidth, 18);
  addText('PAYMENT SUMMARY', margin + 5, yPos + 6, 9, colors.navy, true);
  
  // Find last payment date and amount
  const payments = transactions.filter((t: any) => t.type === 'payment');
  const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null; 
  
  let lastPaymentDate = '-';
  let lastPaymentAmount = 0;
  if (lastPayment) {
     lastPaymentDate = format(new Date(lastPayment.date), 'dd MMM yyyy');
     lastPaymentAmount = lastPayment.amount;
  }

  yPos += 13;
  addText('Last Payment', margin + 5, yPos, 9, colors.grayText);
  addText(lastPaymentDate, margin + 40, yPos, 10, [0, 0, 0]);
  
  // Center separator
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 80, yPos - 6, margin + 80, yPos + 1);
  
  addText('Last Payment Amount', margin + 95, yPos, 9, colors.grayText);
  addText(lastPaymentAmount > 0 ? safeCurrency(lastPaymentAmount) : '-', margin + 145, yPos, 10, colors.green, true);

  // --- VERY BOTTOM FOOTER ---
  yPos = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(colors.grayText[0], colors.grayText[1], colors.grayText[2]);
  doc.text('This is a system generated statement and does not require a signature.', margin, yPos);
  
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
  
  const fallbackText = `*${dealer?.shop_name || 'AquaDealers'}*\n-------------------\n*Balance Statement*\n*Farmer:* ${statement.farmer.name}\n*Period:* ${formatDate(startDate)} to ${formatDate(endDate)}\n\n*Closing Balance:* ${formatCurrency(statement.closingBalance)}\n-------------------\nPlease find the detailed PDF attached.`;
  
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
