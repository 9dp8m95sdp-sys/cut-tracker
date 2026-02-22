import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { mode, input, constraints } = req.body || {};
    if (!mode || !input) return res.status(400).json({ error: "Missing mode or input" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt =
      mode === "workout"
        ? `You are a home-workout assistant.
User: "${input}"
Constraints: "${constraints || "None"}"
Return:
- 3 substitutions OR regressions
- 1 progression
- reps/time for each
- 1 safety note
Bullet points only. Short.`
        : `You are a nutrition assistant for a calorie deficit.
Food: "${input}"
Constraints: "${constraints || "None"}"
Return:
- 5 substitutions
- each: why it's better for a cut (protein/calories/sugar/salt/potassium)
Bullet points only. Short.`;

    const resp = await client.responses.create({
      model: "gpt-5-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    });

    return res.status(200).json({ output: (resp.output_text || "").trim() });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
