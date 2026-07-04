import { EXPORT_COLUMNS, prepareExportData } from './fields.js';

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(records) {
  const rows = prepareExportData(records);
  const header = EXPORT_COLUMNS.map((c) => escapeCsv(c.header)).join(',');
  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((c) => escapeCsv(row[c.key])).join(','),
  );
  return [header, ...lines].join('\n');
}