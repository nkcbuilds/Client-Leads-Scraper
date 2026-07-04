export const EXPORT_COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'first_name', header: 'First Name' },
  { key: 'last_name', header: 'Last Name' },
  { key: 'title', header: 'Title' },
  { key: 'company', header: 'Company' },
  { key: 'company_domain', header: 'Company Domain' },
  { key: 'email', header: 'Email' },
  { key: 'email_status', header: 'Email Status' },
  { key: 'phone', header: 'Phone' },
  { key: 'linkedin_url', header: 'LinkedIn URL' },
  { key: 'award_name', header: 'Award' },
  { key: 'award_year', header: 'Award Year' },
  { key: 'bio', header: 'Bio' },
  { key: 'confidence_label', header: 'Confidence Label' },
  { key: 'overall_confidence', header: 'Overall Confidence' },
  { key: 'llm_confidence', header: 'LLM Confidence' },
  { key: 'source_site', header: 'Source Site' },
  { key: 'source_url', header: 'Source URL' },
];

export function mapRow(record) {
  const row = {};
  for (const col of EXPORT_COLUMNS) {
    let value = record[col.key];
    if (col.key === 'overall_confidence' || col.key === 'llm_confidence') {
      value = value != null ? Number(value).toFixed(2) : '';
    }
    row[col.key] = value ?? '';
  }
  return row;
}

export function prepareExportData(records) {
  return records.map(mapRow);
}