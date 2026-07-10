import { Page } from '@playwright/test';
import { expect, money, test, visibleButton } from './fixtures';
import { TestData, waitForFreshRateLimitWindow } from './helpers/db';

// Money-critical path #1: creating bills through the NewBillPage wizard
// (Items → Payment → Review, RPC create_bill_v2) and verifying bill totals,
// farmer total_due and stock decrement in the database.

const STOCK_QTY = 50;
const SELLING_PRICE = 350; // lot final price — FIFO uses this on the bill

async function seedFarmerAndStock(data: TestData) {
  const farmer = await data.createFarmer();
  const product = await data.createProduct();
  await data.seedStock({
    productId: product.id,
    quantity: STOCK_QTY,
    costPrice: 300,
    sellingPrice: SELLING_PRICE,
  });
  return { farmer, product };
}

async function createBillThroughUi(
  page: Page,
  args: {
    farmerName: string;
    productName: string;
    quantity: number;
    payment: { type: 'cash' | 'credit'; amountPaid?: number };
  }
) {
  await page.goto('/bills/new');

  // Step 1 — Items: pick the farmer …
  await visibleButton(page, 'Change').click();
  const customerModal = page.getByText('Select customer');
  await expect(customerModal).toBeVisible();
  await page.getByPlaceholder('Search customer').fill(args.farmerName);
  await page
    .getByRole('button', { name: new RegExp(args.farmerName) })
    .filter({ visible: true })
    .first()
    .click();
  await expect(customerModal).toBeHidden();

  // … and add the product (desktop layout: search + Add button per row).
  await page.getByPlaceholder('Search products...').fill(args.productName);
  await visibleButton(page, /^Add$/).click();
  for (let i = 1; i < args.quantity; i++) {
    await visibleButton(page, 'Increase quantity').click();
  }
  await visibleButton(page, 'Continue to Payment').click();

  // Step 2 — Payment. Selecting a tile resets Amount Paid (Cash → full,
  // Credit → zero); a partial payment overwrites the amount afterwards.
  if (args.payment.type === 'credit') {
    await visibleButton(page, 'Credit').click();
  } else {
    await visibleButton(page, 'Cash').click();
    if (args.payment.amountPaid !== undefined) {
      const amountInput = page
        .locator('input[type="number"]')
        .filter({ visible: true })
        .first();
      await amountInput.fill(String(args.payment.amountPaid));
    }
  }
  await visibleButton(page, 'Continue to Review').click();

  // Step 3 — Review → Save & Finish (handle the duplicate-bill guard).
  // Seeding may have consumed most of this minute's 30-write budget; give the
  // create_bill_v2 RPC a fresh rate-limit window.
  await waitForFreshRateLimitWindow();
  await visibleButton(page, 'Save & Finish').click();
  const success = page.getByText('Invoice Saved!');
  const duplicate = page.getByRole('button', { name: 'Yes, Create Another' });
  await expect(success.or(duplicate).first()).toBeVisible({ timeout: 30_000 });
  if (await duplicate.isVisible()) {
    await duplicate.click();
  }
  await expect(success).toBeVisible({ timeout: 30_000 });
}

test.describe('Create bill', () => {
  test('cash bill — fully paid, stock decremented, no farmer due', async ({
    page,
    data,
  }) => {
    const { farmer, product } = await seedFarmerAndStock(data);
    const quantity = 2;
    const total = quantity * SELLING_PRICE; // 700

    await createBillThroughUi(page, {
      farmerName: farmer.name,
      productName: product.name,
      quantity,
      payment: { type: 'cash' },
    });
    await expect(page.getByText('Fully Paid')).toBeVisible();

    const [bill] = await data.getBills(farmer.id);
    expect(bill, 'bill row should exist').toBeTruthy();
    expect(money(bill.subtotal)).toBeCloseTo(total, 2);
    expect(money(bill.gst_amount)).toBeCloseTo(0, 2);
    expect(money(bill.total)).toBeCloseTo(total, 2);
    expect(money(bill.amount_paid)).toBeCloseTo(total, 2);
    expect(money(bill.balance_due)).toBeCloseTo(0, 2);
    expect(bill.status).toBe('active');
    // Shown in the success modal pill and again in the hidden print template.
    await expect(page.getByText(bill.bill_number).first()).toBeVisible();

    // Fully paid: farmer owes nothing extra.
    const farmerAfter = await data.getFarmer(farmer.id);
    expect(money(farmerAfter.total_due)).toBeCloseTo(0, 2);

    // Stock decremented.
    const inventory = await data.getInventoryByProduct(product.id);
    expect(money(inventory.quantity_in_stock)).toBeCloseTo(STOCK_QTY - quantity, 2);

    // Payment recorded and mirrored into the cash book.
    const payments = await data.getPayments(farmer.id);
    expect(payments).toHaveLength(1);
    expect(money(payments[0].amount)).toBeCloseTo(total, 2);
    const cashEntries = await data.getCashBookByReference(payments[0].id);
    expect(cashEntries).toHaveLength(1);
    expect(cashEntries[0].entry_type).toBe('income');
    expect(money(cashEntries[0].amount)).toBeCloseTo(total, 2);
  });

  test('credit (udhar) bill — zero paid, farmer due increases', async ({
    page,
    data,
  }) => {
    const { farmer, product } = await seedFarmerAndStock(data);
    const quantity = 3;
    const total = quantity * SELLING_PRICE; // 1050

    await createBillThroughUi(page, {
      farmerName: farmer.name,
      productName: product.name,
      quantity,
      payment: { type: 'credit' },
    });

    const [bill] = await data.getBills(farmer.id);
    expect(bill).toBeTruthy();
    expect(money(bill.total)).toBeCloseTo(total, 2);
    expect(money(bill.amount_paid)).toBeCloseTo(0, 2);
    expect(money(bill.balance_due)).toBeCloseTo(total, 2);

    // The whole bill lands on the farmer's dues.
    const farmerAfter = await data.getFarmer(farmer.id);
    expect(money(farmerAfter.total_due)).toBeCloseTo(total, 2);

    const inventory = await data.getInventoryByProduct(product.id);
    expect(money(inventory.quantity_in_stock)).toBeCloseTo(STOCK_QTY - quantity, 2);

    // Nothing was paid: no payment row, no cash-book income.
    const payments = await data.getPayments(farmer.id);
    expect(payments).toHaveLength(0);
  });

  test('partial payment — split between cash and farmer due', async ({
    page,
    data,
  }) => {
    const { farmer, product } = await seedFarmerAndStock(data);
    const quantity = 2;
    const total = quantity * SELLING_PRICE; // 700
    const paid = 250;

    await createBillThroughUi(page, {
      farmerName: farmer.name,
      productName: product.name,
      quantity,
      payment: { type: 'cash', amountPaid: paid },
    });

    const [bill] = await data.getBills(farmer.id);
    expect(bill).toBeTruthy();
    expect(money(bill.total)).toBeCloseTo(total, 2);
    expect(money(bill.amount_paid)).toBeCloseTo(paid, 2);
    expect(money(bill.balance_due)).toBeCloseTo(total - paid, 2);

    const farmerAfter = await data.getFarmer(farmer.id);
    expect(money(farmerAfter.total_due)).toBeCloseTo(total - paid, 2);

    const inventory = await data.getInventoryByProduct(product.id);
    expect(money(inventory.quantity_in_stock)).toBeCloseTo(STOCK_QTY - quantity, 2);

    const payments = await data.getPayments(farmer.id);
    expect(payments).toHaveLength(1);
    expect(money(payments[0].amount)).toBeCloseTo(paid, 2);
    const cashEntries = await data.getCashBookByReference(payments[0].id);
    expect(cashEntries).toHaveLength(1);
    expect(money(cashEntries[0].amount)).toBeCloseTo(paid, 2);
  });
});
