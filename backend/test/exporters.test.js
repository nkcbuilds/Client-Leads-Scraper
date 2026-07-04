import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportToCsv } from '../src/exporters/csv.js';
import { exportToJson } from '../src/exporters/json.js';
import { exportToExcelBuffer } from '../src/exporters/excel.js';

const sample = [{
  name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  title: 'Partner',
  company: 'Acme LLP',
  company_domain: 'acme.com',
  email: 'jane@acme.com',
  email_status: 'found_public',
  phone: null,
  linkedin_url: 'https://linkedin.com/in/jane',
  award_name: null,
  award_year: null,
  bio: 'Test bio',
  confidence_label: 'HIGH',
  overall_confidence: 0.9,
  llm_confidence: 0.95,
  source_site: 'acme.com',
  source_url: 'https://acme.com/people',
}];

test('exportToCsv produces header and row', () => {
  const csv = exportToCsv(sample);
  assert.ok(csv.startsWith('Name,First Name'));
  assert.ok(csv.includes('Jane Doe'));
});

test('exportToJson includes metadata', () => {
  const json = JSON.parse(exportToJson(sample, { job_id: 1 }));
  assert.equal(json.record_count, 1);
  assert.equal(json.records[0].name, 'Jane Doe');
});

test('exportToExcelBuffer returns non-empty buffer', () => {
  const buf = exportToExcelBuffer(sample);
  assert.ok(buf.length > 100);
});