import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixInventory() {
  console.log('Fetching all products...');
  const { data: products, error: pError } = await supabase.from('products').select('*');
  if (pError) throw pError;
  
  console.log(`Found ${products.length} products.`);

  console.log('Fetching all inventory records...');
  const { data: inventory, error: iError } = await supabase.from('inventory').select('*');
  if (iError) throw iError;
  
  const inventoryProductIds = new Set(inventory.map(i => i.product_id));
  
  const missing = products.filter(p => !inventoryProductIds.has(p.id));
  console.log(`Found ${missing.length} products without inventory records.`);
  
  if (missing.length > 0) {
    const toInsert = missing.map(p => ({
      dealer_id: p.dealer_id,
      product_id: p.id,
      quantity_in_stock: 0,
      medicine_discount_percentage: p.medicine_discount_percentage || 0,
      min_stock_alert: 0
    }));
    
    console.log('Inserting missing inventory records...');
    const { error: insertError } = await supabase.from('inventory').insert(toInsert);
    if (insertError) {
      console.error('Failed to insert missing records:', insertError);
    } else {
      console.log('Successfully inserted missing records!');
    }
  } else {
    console.log('All products have inventory records.');
  }
}

fixInventory().catch(console.error);
