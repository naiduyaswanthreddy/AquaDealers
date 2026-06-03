import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from './utils';
import type { Bill, Dealer, SignatureStroke } from '@/types/database';

const safeCurrency = (val: number) => formatCurrency(val).replace(/₹/g, 'Rs ');

// Helper to render signature strokes to a data URL
const getSignatureDataUrl = (strokes: SignatureStroke[]): string | null => {
  if (!strokes || strokes.length === 0) return null;
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw strokes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      if (!stroke || stroke.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to generate signature image:', error);
    return null;
  }
};

const extractSignatureData = (bill: any): { strokes: SignatureStroke[], signerName: string } | null => {
  const relation = bill?.bill_signatures;
  const signature = Array.isArray(relation) ? relation[0] : relation;
  if (!signature) return null;

  let strokes = signature.signature_data as SignatureStroke[] | string | null | undefined;
  if (typeof strokes === 'string') {
    try {
      strokes = JSON.parse(strokes) as SignatureStroke[];
    } catch {
      strokes = [];
    }
  }

  return {
    strokes: Array.isArray(strokes) ? strokes : [],
    signerName: signature.signer_name || bill.farmer_name_snapshot || 'Customer'
  };
};

export const generateBillPdfBlob = async (bill: any, dealer: Dealer | null): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  let yPos = margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFontSize(24);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.setFont('helvetica', 'bold');
  doc.text(bill.type === 'adjustment' ? 'RATE ADJUSTMENT' : 'INVOICE', margin, yPos);

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
       // Wrap address if it's too long
       const splitAddress = doc.splitTextToSize(addressLine, 80);
       doc.text(splitAddress, pageWidth - margin, yPos, { align: 'right' });
       yPos += splitAddress.length * 4;
    }
  } else {
    yPos += 6;
  }

  // --- Bill Info ---
  yPos = Math.max(yPos, margin + 15);
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(bill.bill_number, margin, yPos);
  
  doc.setFontSize(10);
  doc.text('DATE', pageWidth - margin, yPos - 5, { align: 'right' });
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(bill.bill_date), pageWidth - margin, yPos, { align: 'right' });

  yPos += 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // --- Billed To ---
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('BILLED TO', margin, yPos);
  yPos += 6;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(bill.farmer_name_snapshot || 'Walk-in Customer', margin, yPos);
  
  if (bill.farmer_gstin) {
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`GSTIN: ${bill.farmer_gstin}`, margin, yPos);
  }
  yPos += 15;

  // --- Items Table ---
  let columnsPrefs = { hsn: false, expiry: false, mrp: false, rate: true, discount: true, gst: true };
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('receipt_columns');
    if (saved) {
      try {
        columnsPrefs = { ...columnsPrefs, ...JSON.parse(saved) };
      } catch (e) {}
    }
  }

  const cols: Array<{ name: string; width: number; align: 'left' | 'right' | 'center'; id: string }> = [];
  cols.push({ name: 'ITEM', width: 0, align: 'left', id: 'item' });
  if (columnsPrefs.hsn) cols.push({ name: 'HSN', width: 20, align: 'left', id: 'hsn' });
  if (columnsPrefs.expiry) cols.push({ name: 'EXP', width: 20, align: 'left', id: 'expiry' });
  if (columnsPrefs.mrp) cols.push({ name: 'MRP', width: 20, align: 'right', id: 'mrp' });
  if (columnsPrefs.rate) cols.push({ name: 'RATE', width: 22, align: 'right', id: 'rate' });
  if (columnsPrefs.gst && bill.gst_amount > 0) cols.push({ name: 'GST%', width: 15, align: 'right', id: 'gst' });
  cols.push({ name: 'QTY', width: 15, align: 'right', id: 'qty' });
  cols.push({ name: 'AMOUNT', width: 25, align: 'right', id: 'amount' });

  const usedWidth = cols.reduce((sum, c) => sum + c.width, 0);
  cols[0].width = 170 - usedWidth;

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
  bill.bill_items?.forEach((item: any) => {
    if (yPos > 260) {
      doc.addPage();
      yPos = margin;
    }
    currentX = margin;
    
    // Process item name (wrap if long)
    const nameLines = doc.splitTextToSize(item.product_name_snapshot, cols[0].width - 5);
    doc.text(nameLines, currentX, yPos);
    currentX += cols[0].width;

    if (columnsPrefs.hsn) {
      doc.text(item.hsn_code_snapshot || '-', currentX, yPos);
      currentX += cols.find(c => c.id === 'hsn')?.width || 0;
    }

    if (columnsPrefs.expiry) {
      doc.text(item.expiry_date || '-', currentX, yPos);
      currentX += cols.find(c => c.id === 'expiry')?.width || 0;
    }

    if (columnsPrefs.mrp) {
      const mrpStr = item.mrp ? safeCurrency(item.mrp) : '-';
      doc.text(mrpStr, currentX + (cols.find(c => c.id === 'mrp')?.width || 0), yPos, { align: 'right' });
      currentX += cols.find(c => c.id === 'mrp')?.width || 0;
    }

    if (columnsPrefs.rate) {
      doc.text(safeCurrency(item.unit_price), currentX + (cols.find(c => c.id === 'rate')?.width || 0), yPos, { align: 'right' });
      currentX += cols.find(c => c.id === 'rate')?.width || 0;
    }

    if (columnsPrefs.gst && bill.gst_amount > 0) {
      doc.text(`${item.gst_rate}%`, currentX + (cols.find(c => c.id === 'gst')?.width || 0), yPos, { align: 'right' });
      currentX += cols.find(c => c.id === 'gst')?.width || 0;
    }

    doc.text(String(item.quantity), currentX + (cols.find(c => c.id === 'qty')?.width || 0), yPos, { align: 'right' });
    currentX += cols.find(c => c.id === 'qty')?.width || 0;

    doc.text(safeCurrency(item.unit_price * item.quantity), currentX + (cols.find(c => c.id === 'amount')?.width || 0), yPos, { align: 'right' });

    yPos += Math.max(nameLines.length * 4, 7);
  });

  yPos += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // --- Totals ---
  const totalsX = pageWidth - margin - 50;
  doc.setFontSize(10);
  
  const addTotalRow = (label: string, value: number, isBold: boolean = false, isGreen: boolean = false, isRed: boolean = false) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = margin;
    }
    if (isBold) {
       doc.setFont('helvetica', 'bold');
       doc.setTextColor(0, 0, 0);
    } else {
       doc.setFont('helvetica', 'normal');
       doc.setTextColor(100, 100, 100);
    }
    doc.text(label, totalsX, yPos);
    
    if (isGreen) doc.setTextColor(22, 163, 74);
    else if (isRed) doc.setTextColor(220, 38, 38);
    else if (isBold) doc.setTextColor(30, 58, 138); // blue for total
    else doc.setTextColor(0, 0, 0);

    const valStr = safeCurrency(value);
    doc.text(isGreen && value > 0 ? `-${valStr}` : valStr, pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;
  };

  addTotalRow('Subtotal', bill.subtotal);
  if (bill.cgst_amount > 0) addTotalRow('CGST', bill.cgst_amount);
  if (bill.sgst_amount > 0) addTotalRow('SGST', bill.sgst_amount);
  if (bill.discount_amount > 0) addTotalRow('Discount', bill.discount_amount, false, true);

  yPos += 2;
  doc.setDrawColor(50, 50, 50);
  doc.line(totalsX, yPos - 5, pageWidth - margin, yPos - 5);
  addTotalRow('Total Amount', bill.total, true);
  
  yPos += 2;
  addTotalRow('Amount Paid', bill.amount_paid, false, true);
  if (bill.balance_due > 0) {
    addTotalRow('Balance Due', bill.balance_due, true, false, true);
  }

  // --- Signature ---
  const sigData = extractSignatureData(bill);
  if (sigData && sigData.strokes.length > 0) {
     if (yPos > 240) {
        doc.addPage();
        yPos = margin;
     }
     yPos += 10;
     doc.setFontSize(8);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(100, 100, 100);
     doc.text('CUSTOMER SIGNATURE', margin, yPos);
     
     const imgData = getSignatureDataUrl(sigData.strokes);
     if (imgData) {
       yPos += 2;
       // Add border around signature
       doc.setDrawColor(200, 200, 200);
       doc.rect(margin, yPos, 60, 20);
       doc.addImage(imgData, 'PNG', margin, yPos, 60, 20);
       yPos += 24;
     } else {
       yPos += 26;
     }
     
     doc.setFont('helvetica', 'normal');
     doc.text(`Signed by ${sigData.signerName}`, margin, yPos);
  }

  // --- Footer ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated invoice.', pageWidth / 2, 290, { align: 'center' });

  return doc.output('blob');
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

import { sharePdfViaWhatsApp } from './shareUtils';

export const shareBillPdfViaWhatsApp = async (bill: any, dealer: Dealer | null, farmerPhone?: string): Promise<void> => {
  const blob = await generateBillPdfBlob(bill, dealer);
  
  const customerLabel = bill.farmer_name_snapshot || 'Walk-in Customer';
  const fallbackText = `*AquaDealer Invoice*\n-------------------\n*Bill No:* ${bill.bill_number}\n*Date:* ${formatDate(bill.bill_date)}\n*Billed To:* ${customerLabel}\n\n*Total Amount:* ${formatCurrency(bill.total)}\n*Amount Paid:* ${formatCurrency(bill.amount_paid)}\n*Balance Due:* ${formatCurrency(bill.balance_due)}\n-------------------\nThank you for purchasing with us!`;
  
  await sharePdfViaWhatsApp(blob, `Invoice_${bill.bill_number}.pdf`, fallbackText, farmerPhone);
};
