import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser configuration for handling high-resolution menu images
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));

// Initialize the Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const FIRESTORE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "glossy-autumn-lk8sk";
const FIRESTORE_DATABASE_ID = process.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-b1718f27-059f-49b8-9fe7-4bedbea97879";

// Robust Gemini generation helper with retries and fallback models
async function generateWithRetry(params: {
  contents: any[];
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
}) {
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let finalError: any = null;

  for (const modelName of modelsToTry) {
    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model "${modelName}" (attempt ${attempt + 1})...`);
        const config: any = {};
        if (params.systemInstruction) config.systemInstruction = params.systemInstruction;
        if (params.responseMimeType) config.responseMimeType = params.responseMimeType;
        if (params.responseSchema) config.responseSchema = params.responseSchema;
        if (params.temperature !== undefined) config.temperature = params.temperature;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config,
        });

        if (response && response.text) {
          return response;
        }
        throw new Error("Empty response or missing text field.");
      } catch (err: any) {
        finalError = err;
        console.error(`[Gemini] Error with model "${modelName}":`, err.message || err);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  throw finalError || new Error("Gemini generation failed.");
}

const apiCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getFromCache(key: string): any | null {
  const cached = apiCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data;
  if (cached) apiCache.delete(key);
  return null;
}

function setToCache(key: string, data: any) {
  apiCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// AI menu parsing endpoint
app.post("/api/ai/parse-menu", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", images } = req.body;
    const parts: any[] = [];
    if (Array.isArray(images) && images.length > 0) {
      images.forEach((img) => {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || "image/jpeg",
            data: img.data.replace(/^data:image\/\w+;base64,/, ""),
          },
        });
      });
    } else if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        },
      });
    } else {
      return res.status(400).json({ error: "No images provided" });
    }

    const systemInstruction = `أنت خبير تصميم منيو مطاعم. استخرج 5 أقسام كحد أقصى و 8 أصناف لكل قسم.
اوصف كل صنف بجملة مشهية (4-8 كلمات). استخرج الأسعار بالجنيه المصري.
استنتج اسم المطعم، الهاتف، العنوان، قصة المطعم، وشعار تسويقي.`;

    const response = await generateWithRetry({
      contents: [...parts, { text: "حلل صور المنيو واستخرج البيانات المطلوبة بتنسيق JSON." }],
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.1,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          restaurantDetails: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              phone: { type: Type.STRING },
              address: { type: Type.STRING },
              headline: { type: Type.STRING },
              story: { type: Type.STRING }
            },
            required: ["name", "phone", "address", "headline", "story"]
          },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      price: { type: Type.NUMBER }
                    },
                    required: ["name", "price"]
                  }
                }
              },
              required: ["name", "items"]
            }
          }
        }
      }
    });

    return res.json(JSON.parse(response.text.trim()));
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to parse menu", details: err.message });
  }
});

// AI Customer Support Chat
app.post("/api/ai/support-chat", async (req, res) => {
  try {
    const { userMessage, history = [], restaurantInfo, menuItems = [], activeOrder } = req.body;
    const cacheKey = `chat_${restaurantInfo.name}_${userMessage}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ response: cached });

    const systemInstruction = `أنت مساعد ذكي لمطعم ${restaurantInfo.name}.
تواصل بلباقة وود. استخدم المعلومات المتاحة عن المنيو والفروع والطلبات.
لا تخمن أسعاراً غير موجودة. شجع الزبون على الطلب.`;

    const contents = history.slice(-5).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    const response = await generateWithRetry({ contents, systemInstruction });
    const botResponse = response.text || "عذراً، أعد المحاولة قريباً.";
    setToCache(cacheKey, botResponse);
    return res.json({ response: botResponse });
  } catch (err: any) {
    return res.json({ response: "المساعد الذكي مشغول حالياً، يمكنك التواصل معنا عبر الواتساب! ❤️" });
  }
});

// SMTP REMOVED: Replaced with simple simulation for free tier
app.post("/api/send-report-email", async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`[Simulation] Report sent to ${email}`);
    return res.json({ 
      success: true, 
      message: `تم إرسال التقرير بنجاح (وضع المحاكاة المجاني ✅). تم إرسال PDF افتراضياً إلى: ${email}.`,
      smtpUsed: false 
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Simulation failed" });
  }
});

function parseFirestoreFields(fields: any): any {
  const result: any = {};
  if (!fields) return result;
  for (const [key, valueObj] of Object.entries(fields)) {
    const val: any = valueObj;
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.integerValue !== undefined) result[key] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) result[key] = parseFloat(val.doubleValue);
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
    else if (val.arrayValue !== undefined) {
      result[key] = (val.arrayValue.values || []).map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.mapValue !== undefined) return parseFirestoreFields(v.mapValue.fields);
        return v;
      });
    } else if (val.mapValue !== undefined) result[key] = parseFirestoreFields(val.mapValue.fields);
  }
  return result;
}

app.get("/api/manifest.json", async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) return res.sendFile(path.join(process.cwd(), "public", "manifest.json"));
  try {
    const docId = String(restaurantId).trim();
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/restaurants/${docId}`;
    const response = await fetch(url);
    if (response.ok) {
      const docData: any = await response.json();
      const restaurantData = parseFirestoreFields(docData.fields);
      const appName = restaurantData.customAppName || restaurantData.name || "إسلام فود";
      const iconUrl = restaurantData.customAppIcon || restaurantData.image || "/app_logo.jpg";
      return res.json({
        name: appName,
        short_name: appName,
        start_url: `/r/${restaurantData.slug || docId}`,
        display: "standalone",
        icons: [{ src: iconUrl, sizes: "512x512", type: "image/jpeg" }]
      });
    }
  } catch (err) {}
  return res.sendFile(path.join(process.cwd(), "public", "manifest.json"));
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

async function startServer() {
  const fs = await import("fs");
  const distExists = fs.existsSync(path.join(process.cwd(), "dist", "index.html"));
  if (process.env.NODE_ENV !== "production" || !distExists) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(process.cwd(), "dist", "index.html")));
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
startServer();
