import { expect, money, test } from './fixtures';
import { waitForFreshRateLimitWindow } from './helpers/db';

// Money-critical path #2: recording a stock purchase on NewPurchasePage
// (RPC record_stock_purchase_v2) and verifying inventory quantity and
// supplier due in the database.

test.describe('Record stock purchase', () => {
  test('unpaid purchase — inventory increases, supplier due increases', async ({
    page,
    data,
  }) => {
    const supplier = await data.createSupplier();
    const product = await data.createProduct();

    const quantity = 10;
    const costPrice = 400;
    const expectedTotal = quantity * costPrice; // GST 0 → 4000

    await page.goto('/purchases/new');
    await expect(page.getByText('New Purchase Bill')).toBeVisible();

    await page.locator('select[name="supplier_id"]').selectOption(supplier.id);
    await page
      .locator('input[name="invoice_number"]')
      .fill(`E2E-INV-${data.tag}`);

    // Product picker is a custom SearchableSelect.
    await page.getByText('Select product...').click();
    await page.getByPlaceholder('Type to search...').fill(product.name);
    await page.getByText(`${product.name} - ${product.unit}`).click();

    await page.locator('input[name="items.0.quantity"]').fill(String(quantity));
    await page.locator('input[name="items.0.mrp"]').fill('500');
    await page.locator('input[name="items.0.selling_price"]').fill('450');
    await page
      .locator('input[name="items.0.cost_price_per_unit"]')
      .fill(String(costPrice));
    await page.locator('input[name="items.0.gst_rate"]').fill('0');

    // "Fully Paid" defaults to unchecked and Amount Paid stays empty, so the
    // whole invoice becomes supplier credit. Assert the precondition anyway.
    await expect(page.locator('input[name="is_paid"]')).not.toBeChecked();

    // Give the record_stock_purchase_v2 RPC a fresh rate-limit window.
    await waitForFreshRateLimitWindow();
    // The submit button resolves t('common.save') → "Save" in English.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Purchase recorded successfully')).toBeVisible({
      timeout: 30_000,
    });

    // Inventory row was created by the RPC with the purchased quantity.
    const inventory = await data.getInventoryByProduct(product.id);
    expect(inventory, 'inventory row should exist after purchase').toBeTruthy();
    expect(money(inventory.quantity_in_stock)).toBeCloseTo(quantity, 2);
    expect(money(inventory.cost_price)).toBeCloseTo(costPrice, 2);

    // A FIFO lot carries the full remaining quantity.
    const lots = await data.getLots(inventory.id);
    expect(lots).toHaveLength(1);
    expect(money(lots[0].remaining_quantity)).toBeCloseTo(quantity, 2);
    expect(money(lots[0].cost_price)).toBeCloseTo(costPrice, 2);

    // The purchase row is unpaid and its value moved onto the supplier due.
    const purchases = await data.getStockPurchases(product.id);
    expect(purchases).toHaveLength(1);
    expect(purchases[0].is_paid).toBe(false);
    expect(purchases[0].supplier_id).toBe(supplier.id);
    expect(money(purchases[0].total_amount)).toBeCloseTo(expectedTotal, 2);

    const supplierAfter = await data.getSupplier(supplier.id);
    expect(money(supplierAfter.total_due)).toBeCloseTo(expectedTotal, 2);

    // Unpaid purchases must not create a cash-book expense.
    const cashEntries = await data.getCashBookByReference(purchases[0].id);
    expect(cashEntries).toHaveLength(0);
  });
});
