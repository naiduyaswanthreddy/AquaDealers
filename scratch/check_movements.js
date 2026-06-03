const supabaseUrl = 'https://fgrdcscbrtcewmoprnfr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncmRjc2NicnRjZXdtb3BybmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAxNTksImV4cCI6MjA5NDY3NjE1OX0.pA55rWJXvO6SqiN0KcxEgXMQZTuEWkwUzIyekGqkWAk';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json'
};

async function run() {
  console.log('--- FETCHING ALL INVENTORY ITEMS ---');
  const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*,products(*)`, { headers });
  if (!response.ok) {
    console.error('Error fetching inventory:', await response.text());
    return;
  }
  const invData = await response.json();
  
  invData.forEach(item => {
    console.log(`Inventory ID: ${item.id} | Product: ${item.products?.name} | Qty In Stock: ${item.quantity_in_stock} | Min Stock Alert: ${item.min_stock_alert}`);
  });

  if (invData.length === 0) return;

  const targetId = invData[0].id;
  console.log(`\n--- FETCHING LOTS FOR INVENTORY: ${targetId} ---`);
  const lotResponse = await fetch(`${supabaseUrl}/rest/v1/inventory_lots?inventory_id=eq.${targetId}`, { headers });
  const lotData = await lotResponse.json();
  console.log(JSON.stringify(lotData, null, 2));

  console.log(`\n--- FETCHING MOVEMENTS FOR INVENTORY: ${targetId} ---`);
  const movResponse = await fetch(`${supabaseUrl}/rest/v1/inventory_movements?inventory_id=eq.${targetId}`, { headers });
  const movData = await movResponse.json();
  console.log(JSON.stringify(movData, null, 2));
}

run();
