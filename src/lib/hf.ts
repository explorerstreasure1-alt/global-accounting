/** Minimal HuggingFace fallback (free inference). Env: HUGGINGFACE_API_KEY */

export function hfConfigured(): boolean {
  return Boolean((process.env.HUGGINGFACE_API_KEY || "").trim());
}

export async function hfChat(prompt: string, model = "HuggingFaceH4/zephyr-7b-beta"): Promise<string> {
  const key = (process.env.HUGGINGFACE_API_KEY || "").trim();
  if (!key) throw new Error("HF not configured");
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 250, temperature: 0.4 } }),
  });
  if (!res.ok) throw new Error(`HF ${res.status}`);
  const json = (await res.json()) as Array<{ generated_text?: string }> | { generated_text?: string };
  if (Array.isArray(json)) return json[0]?.generated_text || "";
  return json?.generated_text || "";
}
