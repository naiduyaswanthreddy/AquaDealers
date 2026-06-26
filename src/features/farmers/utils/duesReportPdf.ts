import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Dealer } from '@/types/database';

const safeCurrency = (val: number) => formatCurrency(val).replace(/₹/g, 'Rs ');

export const generateDuesReportPdfBlob = async (
  farmers: any[],
  dealer: Dealer | null,
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  let yPos = margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Filter only farmers with dues
  const farmersWithDues = farmers.filter(f => f.total_due > 0).sort((a, b) => b.total_due - a.total_due);
  const totalDuesAmount = farmersWithDues.reduce((sum, f) => sum + (f.total_due || 0), 0);

  // --- Header ---
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // blue
  doc.setFont('helvetica', 'bold');
  doc.text('OUTSTANDING DUES REPORT', margin, yPos);

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

  // --- Summary Box ---
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Total Farmers with Dues', margin + 5, yPos + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(String(farmersWithDues.length), margin + 5, yPos + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Total Outstanding Amount', pageWidth - margin - 5, yPos + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38); // red
  doc.text(safeCurrency(totalDuesAmount), pageWidth - margin - 5, yPos + 15, { align: 'right' });

  yPos += 30;

  // --- Farmers Table ---
  const cols = [
    { name: 'S.NO', width: 15, align: 'left' },
    { name: 'FARMER NAME', width: 60, align: 'left' },
    { name: 'PHONE / VILLAGE', width: 55, align: 'left' },
    { name: 'OUTSTANDING', width: 40, align: 'right' }
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
  
  farmersWithDues.forEach((farmer: any, index: number) => {
    if (yPos > 270) {
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
    
    // S.NO
    doc.text(String(index + 1), currentX, yPos);
    currentX += cols[0].width;

    // Name (wrapped)
    const nameLines = doc.splitTextToSize(farmer.name, cols[1].width - 5);
    doc.text(nameLines, currentX, yPos);
    currentX += cols[1].width;

    // Contact
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const contactInfo = [farmer.phone, farmer.village].filter(Boolean).join(' • ');
    const contactLines = doc.splitTextToSize(contactInfo || 'Not added', cols[2].width - 5);
    doc.text(contactLines, currentX, yPos);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    currentX += cols[2].width;

    // Due
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(safeCurrency(farmer.total_due), currentX + cols[3].width, yPos, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const maxLines = Math.max(nameLines.length, contactLines.length);
    yPos += Math.max(maxLines * 5, 8);
    
    // Light separator
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
  });

  // --- Footer ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer generated report.', pageWidth / 2, 290, { align: 'center' });

  return doc.output('blob');
};

export const shareDuesReportViaWhatsApp = async (
  farmers: any[], 
  dealer: Dealer | null
): Promise<void> => {
  const { sharePdfViaWhatsApp } = await import('@/lib/shareUtils');
  const blob = await generateDuesReportPdfBlob(farmers, dealer);
  const farmersWithDues = farmers.filter(f => f.total_due > 0);
  const totalAmount = farmersWithDues.reduce((s, f) => s + f.total_due, 0);
  
  const fallbackText = `*${dealer?.shop_name || 'AquaDealers'}*\n-------------------\n*Outstanding Dues Report*\n*Date:* ${formatDate(new Date().toISOString())}\n*Farmers with dues:* ${farmersWithDues.length}\n*Total Outstanding:* ${formatCurrency(totalAmount)}\n-------------------\nPlease find the detailed report PDF attached.`;
  
  await sharePdfViaWhatsApp(blob, `Dues_Report_${new Date().toISOString().split('T')[0]}.pdf`, fallbackText);
};

export const downloadDuesReportPdf = async (
  farmers: any[], 
  dealer: Dealer | null
): Promise<void> => {
  const blob = await generateDuesReportPdfBlob(farmers, dealer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dues_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
