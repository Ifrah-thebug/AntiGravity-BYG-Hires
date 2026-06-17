require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const key = process.env.OPENROUTER_API_KEY;
const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'openai/gpt-oss-120b:free',
      'openai/gpt-oss-20b:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-coder:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-26b-a4b-it:free',
    ];

(async () => {
  for (const model of models) {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://byghires.com',
        'X-Title': 'BYG Hires',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 20,
      }),
    });
    const data = await resp.json();
    const c = data.choices?.[0]?.message?.content;
    const err = data.error?.message || '';
    console.log(`${model} -> ${resp.status} ${c ? `OK (${c.trim()})` : err.slice(0, 70)}`);
  }
})();
