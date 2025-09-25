// Update transactions table to include currency conversion columns
const updateTransactionsTable = async () => {
  console.log('🔄 Adding currency conversion columns to transactions table...');

  try {
    const response = await fetch('http://localhost:3200/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_transaction_conversion_columns'
      })
    });

    const result = await response.json();
    console.log('✅ Migration result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
};

// Run the migration
updateTransactionsTable();
