import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ReportColumn, ReportCellValue, ReportSummaryItem } from '../types';

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const escapeCsvCell = (value: ReportCellValue) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

const escapeHtml = (value: ReportCellValue) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  return normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export function exportRowsToCsv<TRow extends object>(filenameBase: string, columns: ReportColumn[], rows: TRow[]) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => escapeCsvCell((row as Record<string, ReportCellValue>)[column.key])).join(',')).join('\n');
  const csv = [header, body].filter(Boolean).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filenameBase}.csv`);
}

export function exportRowsToExcelCompatibleHtml(
  filenameBase: string,
  title: string,
  columns: ReportColumn[],
  rows: object[]
) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
      </head>
      <body>
        <table border="1">
          <tr>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr>
          ${rows
            .map(
              (row) =>
                `<tr>${columns
                  .map((column) => {
                    const value = (row as Record<string, ReportCellValue>)[column.key];
                    return `<td>${escapeHtml(value)}</td>`;
                  })
                  .join('')}</tr>`
            )
            .join('')}
        </table>
      </body>
    </html>
  `;

  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), `${filenameBase}.xls`);
}

export function exportSummaryPdf(
  filenameBase: string,
  title: string,
  subtitle: string,
  summaries: ReportSummaryItem[],
  notes?: string[]
) {
  const doc = new jsPDF();
  const margin = 18;
  let y = margin;

  doc.setFontSize(20);
  doc.text(title, margin, y);
  y += 9;

  doc.setFontSize(11);
  doc.setTextColor(95, 95, 95);
  doc.text(subtitle, margin, y);
  y += 9;

  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated on ${format(new Date(), 'dd MMM yyyy')}`, margin, y);
  y += 12;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, 192, y);
  y += 10;

  doc.setTextColor(30, 30, 30);
  summaries.forEach((item) => {
    if (y > 275) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(item.value, margin + 80, y);
    y += 8;
  });

  if (notes?.length) {
    y += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    notes.forEach((note) => {
      if (y > 275) {
        doc.addPage();
        y = margin;
      }
      const wrapped = doc.splitTextToSize(`- ${note}`, 170);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5;
    });
  }

  doc.save(`${filenameBase}.pdf`);
}
