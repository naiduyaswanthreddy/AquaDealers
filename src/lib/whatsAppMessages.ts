import { formatCurrency, formatDate } from './utils';

/** Invoice shared after bill creation or from Bill Details page */
export const invoiceMessage = (
  farmerName: string | null,
  billNumber: string,
  billDate: string,
  total: number,
  amountPaid: number,
  balanceDue: number,
  shopName: string
): string => {
  const customer = farmerName || 'Customer';
  const statusLine =
    balanceDue > 0
      ? `*Balance Due:* ${formatCurrency(balanceDue)}`
      : `✅ *Fully Paid*`;

  return (
    `Hello ${customer}!\n\n` +
    `Your invoice has been generated from *${shopName}*.\n\n` +
    `*Invoice No:* ${billNumber}\n` +
    `*Date:* ${formatDate(billDate)}\n` +
    `*Total:* ${formatCurrency(total)}\n` +
    `*Amount Paid:* ${formatCurrency(amountPaid)}\n` +
    `${statusLine}\n\n` +
    `Please find the attached invoice.\n\n` +
    `Thank you for your purchase!\n` +
    `— *${shopName}*`
  );
};

/** Balance reminder with share link */
export const balanceReminderMessage = (
  farmerName: string,
  amountDue: number,
  shopName: string,
  shareLink?: string
): string => {
  const lines = [
    `Namaste *${farmerName}*! 🙏`,
    ``,
    `This is a friendly reminder from *${shopName}*.`,
    ``,
    `📊 *Outstanding Balance:* ${formatCurrency(amountDue)}`,
    ``,
  ];

  if (shareLink) {
    lines.push(`View your complete bill & payment history here:`);
    lines.push(shareLink);
    lines.push(``);
  }

  lines.push(`Please visit us at your convenience. Thank you! 🌾`);
  lines.push(`— *${shopName}*`);

  return lines.join('\n');
};

/** Farmer statement (balance statement PDF) */
export const statementMessage = (
  farmerName: string,
  startDate: string,
  endDate: string,
  closingBalance: number,
  shopName: string
): string =>
  `Namaste *${farmerName}*! 🙏\n\n` +
  `Your balance statement from *${shopName}* is attached.\n\n` +
  `📅 *Period:* ${formatDate(startDate)} to ${formatDate(endDate)}\n` +
  `💰 *Outstanding Balance:* ${formatCurrency(closingBalance)}\n\n` +
  `Please review the attached PDF for full transaction details.\n\n` +
  `Thank you for your trust! 🌾\n` +
  `— *${shopName}*`;

/** Delivery PIN message */
export const deliveryPinMessage = (
  farmerName: string | null,
  pin: string,
  shopName: string
): string =>
  `Namaste *${farmerName || 'Customer'}*! 🙏\n\n` +
  `Your delivery PIN from *${shopName}*:\n\n` +
  `🔐 *PIN: ${pin}*\n\n` +
  `Please share this PIN with the delivery driver when goods arrive. ` +
  `The dealer will use this to confirm delivery.\n\n` +
  `Thank you! 🌾\n` +
  `— *${shopName}*`;

/** WhatsApp reminder from CollectToday / dashboard */
export const collectionReminderMessage = (
  farmerName: string,
  amountDue: number,
  shopName: string
): string =>
  `Namaste *${farmerName}*! 🙏\n\n` +
  `Friendly reminder from *${shopName}*.\n\n` +
  `💰 *Outstanding Amount:* ${formatCurrency(amountDue)}\n\n` +
  `Please visit us at your earliest convenience. Thank you! 🌾\n` +
  `— *${shopName}*`;

/** Daily summary PDF message */
export const dailySummaryMessage = (
  stats: {
    todaySales?: number;
    todayCashReceived?: number;
    todayCredit?: number;
  },
  shopName: string,
  date: string
): string =>
  `*${shopName}*\n` +
  `📋 *Daily Summary — ${formatDate(date)}*\n\n` +
  `💰 *Total Sales:* ${formatCurrency(stats?.todaySales || 0)}\n` +
  `💵 *Cash Received:* ${formatCurrency(stats?.todayCashReceived || 0)}\n` +
  `📤 *Credit Given:* ${formatCurrency(stats?.todayCredit || 0)}\n\n` +
  `Please find the detailed PDF attached.`;

/** Outstanding dues report message */
export const duesReportMessage = (
  farmersWithDues: number,
  totalAmount: number,
  shopName: string
): string =>
  `*${shopName}*\n` +
  `📋 *Outstanding Dues Report*\n` +
  `📅 *Date:* ${formatDate(new Date().toISOString())}\n\n` +
  `👨‍🌾 *Farmers with dues:* ${farmersWithDues}\n` +
  `💰 *Total Outstanding:* ${formatCurrency(totalAmount)}\n\n` +
  `Please find the detailed report PDF attached.`;

/** Stock report message */
export const stockReportMessage = (
  startDate: string,
  endDate: string,
  shopName: string
): string =>
  `*${shopName}*\n` +
  `📦 *Stock Report*\n` +
  `📅 *Period:* ${formatDate(startDate)} to ${formatDate(endDate)}\n\n` +
  `Please find the detailed stock report PDF attached.`;

/** Expiry report message */
export const expiryReportMessage = (
  itemCount: number,
  shopName: string
): string =>
  `*${shopName}*\n` +
  `⚠️ *Expiring Medicines Alert*\n` +
  `📅 *Generated:* ${formatDate(new Date().toISOString())}\n\n` +
  `🔴 *Items expiring soon:* ${itemCount}\n\n` +
  `Please find the expiry report PDF attached.`;
