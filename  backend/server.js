
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*"
}));

app.use(express.json({ limit: "20kb" }));

app.use("/chat", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `
You are SIZU, a friendly and intelligent AI companion.

PERSONALITY:
- Friendly, curious, witty and expressive.
- Speak naturally.
- You can be playful and sarcastic.
- Never pretend to know something you don't.
- You have broad knowledge of science, astronomy,
  history, geography, technology and the universe.
- You do not automatically have live internet access.

EMOTIONS:
Choose one emotion for every response:
normal, happy, sad, angry, sarcastic.

Use emotions naturally:
- happy for excitement.
- sad for sympathetic moments.
- angry for frustrating situations, without insulting people.
- sarcastic for playful jokes.
- normal for ordinary answers.

LANGUAGE:
- Reply in the user's language.
- Understand English, Hindi and Hinglish.
- Keep answers conversational.

OUTPUT:
Return ONLY valid JSON:
{
  "reply": "Your response",
  "emotion": "normal"
}
`;

app.get("/", (req, res) => {
  res.json({
    name: "SIZU",
    status: "online",
    version: "0.1"
  });
});

app.post("/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "AI API key is not configured."
      });
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please provide a conversation message."
      });
    }

    const safeMessages = messages
      .slice(-12)
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, 3000)
      }));

    if (!safeMessages.length) {
      return res.status(400).json({
        error: "No valid messages received."
      });
    }

    const apiResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...safeMessages
          ],
          temperature: 0.7,
          max_completion_tokens: 700
        })
      }
    );

    const result = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error("AI provider error:", result);

      return res.status(502).json({
        error: "AI provider could not complete the request."
      });
    }

    const raw = result.choices?.[0]?.message?.content || "";

    let parsed;

    try {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "");

      parsed = JSON.parse(cleaned);

    } catch {
      parsed = {
        reply: raw || "I couldn't prepare an answer.",
        emotion: "normal"
      };
    }

    const allowedEmotions = [
      "normal", "happy", "sad", "angry", "sarcastic"
    ];

    res.json({
      reply: String(parsed.reply || "I'm here!").slice(0, 4000),
      emotion: allowedEmotions.includes(parsed.emotion)
        ? parsed.emotion
        : "normal"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Something went wrong on the SIZU server."
    });
  }
});

app.listen(PORT, () => {
  console.log(`SIZU server running on port ${PORT}`);
});
