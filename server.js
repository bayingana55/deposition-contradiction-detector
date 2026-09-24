import express from "express";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { transcript1, transcript2 } = req.body;

    if (!transcript1 || !transcript2) {
      return res.status(400).json({
        error: "Both transcripts are required.",
      });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `
Compare these two depositions from the same witness.

Identify statements that may contradict each other.

Return ONLY a valid JSON array. Do not include Markdown,
code fences, headings, or any text outside the JSON array.

Each object must have:
- "claim1": the relevant statement from Transcript 1
- "claim2": the relevant statement from Transcript 2
- "type": "DIRECT", "INFERENTIAL", or "FALSE_POSITIVE"
- "reason": a short explanation of why you chose that type

Do NOT calculate or return a confidence score.

Transcript 1:
${transcript1}

Transcript 2:
${transcript2}
          `,
        },
      ],
    });

    const textBlock = message.content.find(
      (block) => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("Claude did not return text.");
    }
    const cleaned = textBlock.text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

    let contradictions;

    try {
      contradictions = JSON.parse(cleaned);
    } catch {
      throw new Error("Claude returned invalid JSON.");
    }

    if (!Array.isArray(contradictions)) {
      throw new Error("Claude response was not an array.");
    }

    const validTypes = ["DIRECT", "INFERENTIAL", "FALSE_POSITIVE"];

    const isValid = contradictions.every((item) => {
      return (
        typeof item.claim1 === "string" &&
        typeof item.claim2 === "string" &&
        typeof item.reason === "string" &&
        validTypes.includes(item.type)
      );
      });

      if (!isValid) {
        throw new Error("Claude returned invalid contradiction data.");
      }

      res.json({
        contradictions,
      });

    } catch (error) {
      console.error("Claude API error:", error);

    res.status(500).json({
      error: "Failed to analyze transcripts.",
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});