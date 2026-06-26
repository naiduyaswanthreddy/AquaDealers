import jsPDF from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FarmerItemSummary, FarmerItemsSummary } from '../types/farmerItems';

const safeCurrency = (value: number) => formatCurrency(value).replace(/₹/g, 'Rs ');

export function generateFarmerItemsPdf(params: {
  farmerName: string;
  startDate: string;
  endDate: string;
  summary: FarmerItemsSummary;
  items: FarmerItemSummary[];
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const addHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('PURCHASED ITEMS', margin, y);
    y += 7;
    doc.setFontSize(11);
    doc.text(params.farmerName, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${formatDate(params.startDate)} to ${formatDate(params.endDate)}`, pageWidth - margin, y, { align: 'right' });
    y += 10;
  };

  addHeader();
  const stats = [
    `Products: ${params.summary.total_products}`,
    `Quantity: ${params.summary.total_quantity}`,
    `Value: ${safeCurrency(params.summary.total_value)}`,
    `Unpaid: ${safeCurrency(params.summary.unpaid_amount)}`,
  ];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  stats.forEach((stat, index) => doc.text(stat, margin + index * 46, y));
  y += 8;

  const drawColumns = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('PRODUCT', margin + 2, y + 5);
    doc.text('QTY', 112, y + 5, { align: 'right' });
    doc.text('VALUE', 148, y + 5, { align: 'right' });
    doc.text('UNPAID', pageWidth - margin - 2, y + 5, { align: 'right' });
    y += 10;
  };

  drawColumns();
  params.items.forEach((item) => {
    if (y > pageHeight - 18) {
      doc.addPage();
      y = margin;
      addHeader();
      drawColumns();
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(item.product_name, 75)[0], margin + 2, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${item.total_quantity} ${item.unit}`, 112, y + 3, { align: 'right' });
    doc.text(safeCurrency(item.total_value), 148, y + 3, { align: 'right' });
    doc.setTextColor(item.unpaid_amount > 0 ? 220 : 22, item.unpaid_amount > 0 ? 38 : 163, item.unpaid_amount > 0 ? 38 : 74);
    doc.text(safeCurrency(item.unpaid_amount), pageWidth - margin - 2, y + 3, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);
    y += 10;
  });

  doc.save(`${params.farmerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-items.pdf`);
}
