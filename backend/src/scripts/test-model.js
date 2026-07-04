import '../utils/env.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractPeopleWithGemini } from '../llm/gemini.js';

const model = process.argv[2];
if (!model) {
  console.error('Usage: node test-model.js <model-id>');
  process.exit(1);
}

process.env.GEMINI_MODEL = model;
process.env.GEMINI_FALLBACK_MODELS = '';

const sample = `Jane Doe, Partner at Acme Law Firm, was named Leading Lawyer in 2024.
John Smith, General Counsel at Global Legal LLC, received the Excellence Award in 2023.
Megan M. Alessi, Partner at Latham & Watkins LLP, specializes in M&A.`;

async function main() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const t0 = Date.now();
  try {
    const m = genAI.getGenerativeModel({
      model,
      generationConfig: { responseMimeType: 'application/json' },
    });
    await m.generateContent('Return JSON: {"ok":true}');
    console.log(`${model}: API reachable (${Date.now() - t0}ms)`);
  } catch (e) {
    console.error(`${model}: API FAIL`, e.status, e.message?.slice(0, 200));
    process.exit(1);
  }

  const t1 = Date.now();
  const people = await extractPeopleWithGemini(sample, 'https://example.com/awards');
  console.log(`${model}: Extracted ${people.length} people in ${Date.now() - t1}ms`);
  console.log(JSON.stringify(people, null, 2));
}

main();