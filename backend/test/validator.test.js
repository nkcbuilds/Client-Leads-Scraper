import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePerson, filterValidPeople, splitName, isGarbageName } from '../src/llm/validator.js';

test('splitName handles multi-part names', () => {
  assert.deepEqual(splitName('Jane Marie Doe'), { first_name: 'Jane', last_name: 'Marie Doe' });
});

test('validatePerson rejects records without title or company', () => {
  const result = validatePerson({ name: 'Jane Doe', confidence: 0.9 });
  assert.equal(result.valid, false);
});

test('validatePerson rejects low confidence', () => {
  const result = validatePerson({ name: 'Jane Doe', title: 'Partner', confidence: 0.2 });
  assert.equal(result.valid, false);
});

test('isGarbageName rejects UI noise from directory pages', () => {
  assert.equal(isGarbageName('ClearExpand'), true);
  assert.equal(isGarbageName('Industry facetSearchLoadingAerospace'), true);
  assert.equal(isGarbageName('Jane Doe'), false);
  assert.equal(isGarbageName('Megan M. Alessi'), false);
});

test('filterValidPeople rejects garbage directory noise', () => {
  const records = [
    { name: 'ClearExpand', title: 'Industry facet', company: 'Defense(171)', confidence: 0.35 },
    { name: 'Jane Doe', title: 'Partner', company: 'Acme LLP', confidence: 0.9 },
  ];
  const valid = filterValidPeople(records, 'https://example.com', 'example.com');
  assert.equal(valid.length, 1);
  assert.equal(valid[0].name, 'Jane Doe');
});

test('filterValidPeople deduplicates within batch', () => {
  const records = [
    { name: 'Jane Doe', title: 'Partner', company: 'Acme LLP', confidence: 0.9 },
    { name: 'Jane Doe', title: 'Partner', company: 'Acme LLP', confidence: 0.8 },
  ];
  const valid = filterValidPeople(records, 'https://example.com', 'example.com');
  assert.equal(valid.length, 1);
});