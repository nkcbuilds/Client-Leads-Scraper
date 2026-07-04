import '../utils/env.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractPeopleWithGemini } from '../llm/gemini.js';

const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];

async function testModel(modelName) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent('Return JSON: {"ok": true}');
  return result.response.text();
}

async function main() {
  for (const model of models) {
    try {
      const text = await testModel(model);
      console.log(`${model}: OK ->`, text);
    } catch (err) {
      console.log(`${model}: FAIL ->`, err.status || err.message?.slice(0, 120));
    }
  }
}

main();