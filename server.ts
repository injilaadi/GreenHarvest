import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazily load or locate the Google GenAI instance
let genAIInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is missing or placeholder. Please set it in Settings > Secrets.");
    }
    genAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for webcam image base64 payloads
  app.use(express.json({ limit: "15mb" }));

  // API Route: Scan Water Bottles or other emergency supplies using Gemini
  app.post("/api/scan-bottles", async (req, res) => {
    try {
      const { image, supplyType = "water" } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image data in request" });
      }

      // Convert type to friendly plural noun
      let itemLabel = "water bottles";
      if (supplyType === "food") itemLabel = "non-perishable food emergency packs/MREs";
      else if (supplyType === "medical") itemLabel = "medical emergency kits or bandage dressings";
      else if (supplyType === "shelter") itemLabel = "thermal sleeping bags, blankets or tents";

      // Extract base64 clean data (strip data:image/jpeg;base64, header if present)
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const ai = getGenAI();

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      };

      const promptPart = {
        text: `Count the exact number of ${itemLabel} present in the image. Be precise and identify individual items. Return a JSON object matching the requested schema.`,
      };

      // Query Gemini 3.5 Flash for the count of specific items
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              count: {
                type: Type.INTEGER,
                description: `The total number of individual ${itemLabel} detected in the image.`,
              },
            },
            required: ["count"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from AI model");
      }

      const result = JSON.parse(responseText.trim());
      res.json({ count: typeof result.count === "number" ? result.count : 0 });
    } catch (error: any) {
      console.error("AI Scan Error:", error);
      res.status(500).json({
        error: error.message || "An error occurred during image processing",
      });
    }
  });

  // Serve static UI or Vite development middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GreenHarvest Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start GreenHarvest server:", err);
});
