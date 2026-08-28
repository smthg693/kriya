const { initDatabase, dbAsync } = require('./database');
const fs = require('fs');
const path = require('path');

async function exportLogs() {
  await initDatabase();
  console.log("📥 Exporting low-confidence and fallback NLU logs for retraining review...");
  
  const logs = await dbAsync.findMany('nlu_logs', {
    $or: [
      { confidence: { $lt: 0.75 } },
      { final_action: 'DISAMBIGUATION' },
      { final_action: 'FALLBACK' }
    ]
  }, { sort: { timestamp: -1 }, limit: 500 });

  if (!logs || logs.length === 0) {
    console.log("✨ No low-confidence logs found to export.");
    process.exit(0);
  }

  const csvRows = ['text,language,intent'];
  logs.forEach(l => {
    const escapedText = `"${l.text.replace(/"/g, '""')}"`;
    csvRows.push(`${escapedText},${l.language || 'en'},${l.predicted_intent || 'FALLBACK'}`);
  });

  const exportPath = path.join(__dirname, 'nlu_service', 'retrain_review.csv');
  fs.writeFileSync(exportPath, csvRows.join('\n'), 'utf8');

  console.log(`✅ Exported ${logs.length} queries to: ${exportPath}`);
  console.log("👉 Review and merge into nlu_service/labeled_utterances.csv, then run python train_intent_model.py!");
  process.exit(0);
}

if (require.main === module) {
  exportLogs();
}
