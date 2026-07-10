import { expect, money, test, visibleButton } from './fixtures';
import { waitForFreshRateLimitWindow } from './helpers/db';

// Money-critical path #3: collecting a farmer payment from the ledger page
// (RPC collect_farmer_payment_v2, oldest-first allocation) and verifying the
// farmer due decrease, bill balances, allocations and the cash-book entry.

const SELLING_PRICE = 100;

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

test.describe('Collect farmer payment', () => {
  test('oldest-first allocation clears the older bill first', async ({
    page,
    data,
  }) => {
    const farmer = await data.createFarmer();
    const product = await data.createProduct();
    const stock = await data.seedStock({
      productId: product.id,
      quantity: 50,
      costPrice: 80,
      sellingPrice: SELLING_PRICE,
    });

    // Two open credit bills: 300 (older) + 400 (newer) → farmer owes 700.
    await data.createCreditBill({
      farmerId: farmer.id,
      inventoryId: stock.inventory_id,
      productId: product.id,
      productName: product.name,
      quantity: 3,
      billDate: daysAgo(6),
    });
    await data.createCreditBill({
      farmerId: farmer.id,
      inventoryId: stock.inventory_id,
      productId: product.id,
      productName: product.name,
      quantity: 4,
      billDate: daysAgo(2),
    });
    const farmerBefore = await data.getFarmer(farmer.id);
    expect(money(farmerBefore.total_due)).toBeCloseTo(700, 2);

    // Collect ₹400 from the ledger page: covers the older 300-bill fully and
    // 100 of the newer one.
    await page.goto(`/farmers/${farmer.id}`);
    await visibleButton(page, 'Collect').click();
    await expect(page.getByText('Collect Payment')).toBeVisible();
    await page.getByPlaceholder('e.g. 50000').fill('400');
    // Defaults: method = Cash, allocation = oldest first. Give the RPC a
    // fresh rate-limit window before submitting.
    await waitForFreshRateLimitWindow();
    await page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(page.getByText('Payment recorded successfully!')).toBeVisible({
      timeout: 30_000,
    });

    // Farmer due decreased by the collected amount.
    const farmerAfter = await data.getFarmer(farmer.id);
    expect(money(farmerAfter.total_due)).toBeCloseTo(300, 2);

    // Oldest-first: older bill cleared, newer bill partially adjusted.
    const [older, newer] = await data.getBills(farmer.id);
    expect(money(older.total)).toBeCloseTo(300, 2);
    expect(money(older.balance_due)).toBeCloseTo(0, 2);
    expect(money(newer.total)).toBeCloseTo(400, 2);
    expect(money(newer.balance_due)).toBeCloseTo(300, 2);

    // One payment with a receipt, allocated oldest-first across both bills.
    const payments = await data.getPayments(farmer.id);
    expect(payments).toHaveLength(1);
    const payment = payments[0];
    expect(money(payment.amount)).toBeCloseTo(400, 2);
    expect(payment.receipt_number).toBeTruthy();

    const allocations = await data.getAllocations(payment.id);
    expect(allocations).toHaveLength(2);
    expect(allocations[0].bill_id).toBe(older.id);
    expect(money(allocations[0].allocated_amount)).toBeCloseTo(300, 2);
    expect(allocations[1].bill_id).toBe(newer.id);
    expect(money(allocations[1].allocated_amount)).toBeCloseTo(100, 2);

    // Cash book gained an income entry for the receipt.
    const cashEntries = await data.getCashBookByReference(payment.id);
    expect(cashEntries).toHaveLength(1);
    expect(cashEntries[0].entry_type).toBe('income');
    expect(cashEntries[0].source).toBe('farmer_payment');
    expect(money(cashEntries[0].amount)).toBeCloseTo(400, 2);
  });
});
