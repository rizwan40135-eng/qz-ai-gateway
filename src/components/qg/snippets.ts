export function snippets(base: string, key: string, alias: string) {
  return {
    env: `OPENAI_API_KEY=${key}\nOPENAI_BASE_URL=${base}\nMODEL=${alias}`,
    openai: `from openai import OpenAI\n\nclient = OpenAI(\n    api_key="${key}",\n    base_url="${base}"\n)\n\nresponse = client.responses.create(\n    model="${alias}",\n    input="Review this code for potential bugs."\n)\nprint(response.output_text)`,
    anthropic: `import anthropic\n\nclient = anthropic.Anthropic(\n    api_key="${key}",\n    base_url="${base.replace(/\/v1$/, "")}"\n)\n\nmessage = client.messages.create(\n    model="${alias}",\n    max_tokens=1024,\n    system="You are a senior reviewer.",\n    messages=[{"role": "user", "content": "Review this function."}]\n)\nprint(message.content[0].text)`,
    python: `import requests\n\nr = requests.post(\n    "${base}/chat/completions",\n    headers={"Authorization": "Bearer ${key}"},\n    json={"model": "${alias}", "messages": [{"role": "user", "content": "Hello"}]},\n)\nprint(r.json()["choices"][0]["message"]["content"], r.headers["x-qgate-request-id"])`,
    node: `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  apiKey: process.env.OPENAI_API_KEY, // ${key.slice(0, 13)}…\n  baseURL: "${base}",\n});\n\nconst stream = await client.responses.create({\n  model: "${alias}",\n  input: "Write a unit test for parseDate()",\n  stream: true,\n});\nfor await (const ev of stream) {\n  if (ev.type === "response.output_text.delta") process.stdout.write(ev.delta);\n}`,
    curl: `curl ${base}/responses \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${alias}","input":"Explain this stack trace","stream":true}'`,
    rest: `POST ${base}/chat/completions\nAuthorization: Bearer ${key}\nContent-Type: application/json\n\n{\n  "model": "${alias}",\n  "messages": [{"role": "user", "content": "Hello"}],\n  "stream": false\n}\n\nGET ${base}/models   → entitlement-aware alias list\nPOST ${base}/messages → Anthropic-compatible\nPOST ${base}/embeddings → qz-embedding`,
  };
}

