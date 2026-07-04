import { prepareExportData } from './fields.js';

export function exportToJson(records, meta = {}) {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      record_count: records.length,
      ...meta,
      records: prepareExportData(records),
    },
    null,
    2,
  );
}