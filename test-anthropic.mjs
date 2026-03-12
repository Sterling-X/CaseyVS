import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in .env");
  process.exit(1);
}

const client = new Anthropic();

try {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 50,
    messages: [{ role: "user", content: "Say: API is connected." }],
  });

  console.log(message.content[0].text);
} catch (error) {
  console.error("API request failed.");
  console.error(error?.message ?? error);
  process.exit(1);
}
