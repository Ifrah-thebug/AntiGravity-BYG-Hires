require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const key = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

async function test(label, body) {
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
  try {
    const data = JSON.parse(text);
    if (data.error) {
      console.log('error:', JSON.stringify(data.error, null, 2));
      return;
    }
    const choice = data.choices?.[0];
    console.log('finish_reason:', choice?.finish_reason);
    console.log('native_finish_reason:', choice?.native_finish_reason);
    console.log('content:', JSON.stringify(choice?.message?.content)?.slice(0, 400));
    if (!choice?.message?.content) {
      console.log('full payload:', JSON.stringify(data, null, 2).slice(0, 1200));
    }
  } catch {
    console.log(text.slice(0, 500));
  }
}

(async () => {
  console.log('key present:', Boolean(key), key ? `${key.slice(0, 12)}...` : '');
  console.log('model:', model);

  const auth = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${key}` },
  });
  console.log(`\n=== auth/key — HTTP ${auth.status} ===`);
  console.log((await auth.text()).slice(0, 500));

  await test('simple ping', {
    model,
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    max_tokens: 50,
  });

  await test('json_object mode', {
    model,
    messages: [{ role: 'user', content: 'Return JSON only with key ok set to true' }],
    max_tokens: 100,
    response_format: { type: 'json_object' },
  });

  await test('openrouter/free', {
    model: 'openrouter/free',
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    max_tokens: 50,
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
