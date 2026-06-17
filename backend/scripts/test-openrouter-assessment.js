require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const key = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

const SAMPLE_PROMPT = `Create exactly 5 unique skills-test questions for: "JavaScript".
Role: Developer, 3 yrs exp, engineering.
Mix: 2 scenarios, 2 practical how-to, 1 judgment. Open-ended written answers only.
JSON only:
{"questions":[{"id":"q1","type":"scenario","prompt":"...","max_points":20}]}`;

async function call(label, body) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://byghires.com',
      'X-Title': 'BYG Hires',
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  console.log(`\n=== ${label} — HTTP ${resp.status} ===`);
  const data = JSON.parse(text);
  if (data.error) {
    console.log('error:', data.error);
    return;
  }
  const msg = data.choices?.[0]?.message || {};
  console.log('finish_reason:', data.choices?.[0]?.finish_reason);
  console.log('content len:', msg.content ? msg.content.length : 0);
  console.log('reasoning len:', msg.reasoning ? msg.reasoning.length : 0);
  console.log('content preview:', (msg.content || '').slice(0, 300));
  if (!msg.content && msg.reasoning) {
    console.log('reasoning preview:', msg.reasoning.slice(0, 300));
  }
}

(async () => {
  await call('assessment-like prompt', {
    model,
    messages: [{ role: 'user', content: SAMPLE_PROMPT }],
    temperature: 0.6,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  });

  await call('assessment without json_object', {
    model,
    messages: [{ role: 'user', content: SAMPLE_PROMPT }],
    temperature: 0.6,
    max_tokens: 2048,
  });
})();
