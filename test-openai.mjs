import "dotenv/config";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

try {
  const response = await client.responses.create({
    model: "gpt-5",
    input: "Say: API is connected.",
  });

  console.log(response.output_text);
} catch (error) {
  console.error("API request failed.");
  console.error(error?.message ?? error);
  process.exit(1);
}

