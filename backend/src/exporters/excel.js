import * as XLSX from 'xlsx';
import { EXPORT_COLUMNS, prepareExportData } from './fields.js';

export function exportToExcelBuffer(records) {
  const rows = prepareExportData(records);
  const sheetData = [
    EXPORT_COLUMNS.map((c) => c.header),
    ...rows.map((row) => EXPORT_COLUMNS.map((c) => row[c.key])),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}