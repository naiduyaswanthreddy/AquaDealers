import jsPDF from 'jspdf';
import { formatCurrency } from './utils';
import { format } from 'date-fns';

export interface ReportConfig {
  title: string;
  subtitle?: string;
  metrics: { label: string; value: string | number }[];
  date?: string;
}

export const generateGenericReportPDF = (config: ReportConfig) => {
  const doc = new jsPDF();
  const margin = 20;
  let yPos = margin;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(config.title, margin, yPos);
  yPos += 10;

  // Subtitle
  if (config.subtitle) {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(config.subtitle, margin, yPos);
    yPos += 15;
  }

  // Date
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  const reportDate = config.date || format(new Date(), 'MMM dd, yyyy');
  doc.text(`Generated on: ${reportDate}`, margin, yPos);
  yPos += 15;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, 210 - margin, yPos);
  yPos += 15;

  // Metrics
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  
  config.metrics.forEach((metric) => {
    // Check page boundary
    if (yPos > 270) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${metric.label}:`, margin, yPos);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`${metric.value}`, margin + 80, yPos);
    
    yPos += 10;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('AquaDealer Management System - Internal Document', margin, 290);

  // Save the PDF
  const filename = `${config.title.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
};
