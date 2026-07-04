import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichPerson } from '../src/enrichment/index.js';

test('enrichPerson uses matched source domain for firm directories', async () => {
  const person = {
    id: 1,
    name: 'Jane Doe',
    first_name: 'Jane',
    last_name: 'Doe',
    title: 'Partner',
    company: 'Latham & Watkins LLP',
    source_url: 'https://www.lw.com/en/people',
    source_site: 'lw.com',
    llm_confidence: 0.95,
  };
  const text = 'Contact jane.doe@lw.com or call +1-202-555-0100';
  const contact = await enrichPerson(person, text);

  assert.equal(contact.company_domain, 'lw.com');
  assert.equal(contact.email, 'jane.doe@lw.com');
  assert.equal(contact.email_status, 'verified_mx');
  assert.equal(contact.linkedin_url, null);
  assert.equal(contact.confidence_label, 'HIGH');
});

test('enrichPerson avoids publisher-domain guesses on award pages', async () => {
  const person = {
    id: 2,
    name: 'John Smith',
    first_name: 'John',
    last_name: 'Smith',
    title: 'Associate',
    company: 'Acme Law',
    source_url: 'https://law.asia/india-in-house-counsel-awards-2025/',
    source_site: 'law.asia',
    llm_confidence: 0.8,
  };
  const contact = await enrichPerson(person, 'No emails on this page.');

  assert.equal(contact.company_domain, null);
  assert.equal(contact.email, null);
  assert.equal(contact.email_status, null);
  assert.equal(contact.linkedin_url, null);
  assert.equal(contact.confidence_label, 'LOW');
});
