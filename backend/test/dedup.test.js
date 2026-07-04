import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deduplicatePeople } from '../src/dedup/deduplicator.js';

test('deduplicatePeople merges exact name+company match', () => {
  const people = [
    { name: 'Jane Doe', company: 'Acme LLP', title: 'Partner', llm_confidence: 0.9 },
    { name: 'Jane Doe', company: 'Acme LLP', title: 'Managing Partner', llm_confidence: 0.95 },
  ];
  const { unique, removed } = deduplicatePeople(people);
  assert.equal(unique.length, 1);
  assert.equal(removed, 1);
  assert.equal(unique[0].title, 'Managing Partner');
});

test('deduplicatePeople keeps distinct people', () => {
  const people = [
    { name: 'Jane Doe', company: 'Acme LLP', title: 'Partner' },
    { name: 'John Smith', company: 'Beta LLC', title: 'Counsel' },
  ];
  const { unique } = deduplicatePeople(people);
  assert.equal(unique.length, 2);
});