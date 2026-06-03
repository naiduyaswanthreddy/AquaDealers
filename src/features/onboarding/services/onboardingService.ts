import { supabase } from '@/lib/supabase';
import type { Dealer } from '@/types/database';

const STEP_COLUMN_MAP: Record<string, string> = {
  shop_details: 'step_1_shop_details_at',
  language: 'step_2_language_at',
  catalog: 'step_3_first_product_at',
  first_farmer: 'step_4_first_farmer_at',
  set_pin: 'step_5_set_pin_at',
};

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  return !!error?.message && error.message.includes(column);
}

/**
 * Mark an onboarding step as completed for a dealer.
 * Uses one row per dealer with timestamp columns per step.
 */
export async function completeStep(dealerId: string, step: string): Promise<void> {
  let column = STEP_COLUMN_MAP[step];

  if (!column) {
    throw new Error(`Unknown onboarding step: ${step}`);
  }

  const now = new Date().toISOString();
  let { error } = await supabase
    .from('onboarding_progress')
    .upsert(
      {
        dealer_id: dealerId,
        [column]: now,
        completed_at: step === 'set_pin' ? now : undefined,
      },
      { onConflict: 'dealer_id' }
    );

  if (step === 'set_pin' && isMissingColumnError(error, 'step_5_set_pin_at')) {
    column = 'step_5_first_bill_at';
    ({ error } = await supabase
      .from('onboarding_progress')
      .upsert(
        {
          dealer_id: dealerId,
          [column]: now,
          completed_at: now,
        },
        { onConflict: 'dealer_id' }
      ));
  }

  if (error) throw error;
}

/**
 * Get all completed onboarding steps for a dealer.
 * Returns an array of step name strings.
 */
export async function getProgress(dealerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('dealer_id', dealerId)
    .maybeSingle();

  if (error) throw error;

  if (!data) return [];

  const completedSteps: string[] = [];
  if (data.step_1_shop_details_at) completedSteps.push('shop_details');
  if (data.step_2_language_at) completedSteps.push('language');
  if (data.step_3_first_product_at) completedSteps.push('catalog');
  if (data.step_4_first_farmer_at) completedSteps.push('first_farmer');
  if (data.step_5_set_pin_at || data.step_5_first_bill_at) completedSteps.push('set_pin');

  return completedSteps;
}

/**
 * Update a dealer's profile with partial data.
 */
export async function updateDealerProfile(
  dealerId: string,
  data: Partial<Dealer>
): Promise<void> {
  const { error } = await supabase
    .from('dealers')
    .update(data)
    .eq('id', dealerId);

  if (error) throw error;
}

/**
 * Add a farmer for the given dealer & branch.
 */
export async function addFarmer(
  dealerId: string,
  branchId: string,
  data: { name: string; phone?: string; village?: string }
): Promise<string> {
  const { data: farmer, error } = await supabase
    .from('farmers')
    .insert({
      dealer_id: dealerId,
      branch_id: branchId,
      name: data.name,
      phone: data.phone || null,
      village: data.village || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return farmer.id;
}

/**
 * Fetch active products for the catalog preview.
 */
export async function fetchProducts(type?: string) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Store the dealer's hashed PIN and timeout preference.
 */
export async function setDealerPin(
  dealerId: string,
  pinHash: string,
  timeoutMinutes: number
): Promise<void> {
  const { error } = await supabase
    .from('dealers')
    .update({
      pin_hash: pinHash,
      pin_timeout_minutes: timeoutMinutes,
    })
    .eq('id', dealerId);

  if (error) throw error;
}
