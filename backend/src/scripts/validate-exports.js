import '../utils/env.js';
import { initDb, closeDb } from '../db/index.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { exportToCsv } from '../exporters/csv.js';
import { exportToJson } from '../exporters/json.js';
import { exportToExcelBuffer } from '../exporters/excel.js';

const jobId = process.argv[2] || '5';

initDb();
const records = getEnrichedPeopleByJob(jobId);

if (records.length === 0) {
  console.error(`No records for job ${jobId}`);
  process.exit(1);
}

const csv = exportToCsv(records);
const json = exportToJson(records, { job_id: jobId });
const xlsx = exportToExcelBuffer(records);

console.log('Export validation:');
console.log(`  Records: ${records.length}`);
console.log(`  CSV bytes: ${csv.length}`);
console.log(`  JSON bytes: ${json.length}`);
console.log(`  XLSX bytes: ${xlsx.length}`);
console.log('  CSV header:', csv.split('\n')[0].slice(0, 80) + '...');
console.log('\nPASS: All export formats generated');
closeDb();