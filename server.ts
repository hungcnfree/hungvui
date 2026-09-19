import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Constants for Gemini models
const TTS_PRIMARY_MODEL = "gemini-3.1-flash-tts-preview";
const TTS_FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const TEXT_MODEL = "gemini-3.8-flash";

// Helper: Convert raw 16-bit mono 24000Hz PCM to WAV with standard 44-byte header
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataLength = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);

  // Subchunk 1: "fmt "
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // Subchunk 2: "data"
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Helper to get GoogleGenAI client with key from header or process.env
function getGenAIClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chưa có API key Gemini. Vui lòng cấu hình trong Cài đặt hoặc biến môi trường.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// --- API ROUTES ---

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasEnvKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Check API key connection
app.post("/api/check-key", async (req, res) => {
  try {
    const customKey = req.headers["x-gemini-key"] as string | undefined;
    const ai = getGenAIClient(customKey);
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: "Chào bạn ngắn gọn 1 từ",
    });
    res.json({
      success: true,
      message: "Kết nối Gemini API thành công!",
      sample: response.text?.trim() || "OK",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error?.message || "Lỗi kiểm tra API key",
    });
  }
});

// Generate TTS Audio
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore", promptPrefix } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Thiếu văn bản cần đọc" });
    }

    const customKey = req.headers["x-gemini-key"] as string | undefined;
    const ai = getGenAIClient(customKey);

    const prefix = promptPrefix || "Đọc với giọng MC gameshow truyền hình, sôi nổi, rõ ràng, tốc độ vừa phải cho học sinh lớp 8:";
    const fullPrompt = `${prefix} ${text.trim()}`;

    // Try primary model first, fallback to secondary if not supported
    const modelsToTry = [TTS_PRIMARY_MODEL, TTS_FALLBACK_MODEL];
    let lastError: any = null;
    let base64Pcm: string | undefined = undefined;
    let modelUsed = "";

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: fullPrompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
              },
            },
          },
        });

        base64Pcm = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Pcm) {
          modelUsed = model;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Thử model TTS ${model} thất bại:`, err?.message || err);
      }
    }

    if (!base64Pcm) {
      throw lastError || new Error("Không nhận được dữ liệu âm thanh từ Gemini TTS");
    }

    // Convert raw PCM 16-bit 24kHz to WAV with 44-byte header
    const pcmBuffer = Buffer.from(base64Pcm, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
    const wavBase64 = wavBuffer.toString("base64");

    res.json({
      success: true,
      audioBase64: `data:audio/wav;base64,${wavBase64}`,
      modelUsed,
      sizeBytes: wavBuffer.length,
    });
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED");
    res.status(isRateLimit ? 429 : 500).json({
      error: error?.message || "Lỗi tạo giọng đọc TTS",
      isRateLimit,
    });
  }
});

// Auto-generate missing explanation
app.post("/api/explain", async (req, res) => {
  try {
    const { question, options, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "Thiếu thông tin câu hỏi hoặc đáp án" });
    }

    const customKey = req.headers["x-gemini-key"] as string | undefined;
    const ai = getGenAIClient(customKey);

    const prompt = `Bạn là giáo viên Công nghệ THCS vui tính, nhiệt tình. Hãy viết một câu nhận xét ngắn gọn (tối đa 2 câu, khoảng 20-30 từ) giải thích lý do vì sao đáp án ${answer} là đúng cho câu hỏi sau:
Câu hỏi: ${question}
${options && Array.isArray(options) ? `Phương án:\n${options.join("\n")}` : ""}
Đáp án đúng: ${answer}

Yêu cầu:
- Bắt đầu bằng lời khen/nhận xét sôi nổi (ví dụ: "Chính xác!", "Tuyệt vời!", "Rất xuất sắc!").
- Nêu ngắn gọn lý do kỹ thuật/kiến thức Công nghệ.
- Trả về duy nhất nội dung câu nhận xét, không thêm định dạng, không mở ngoặc kép.`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });

    const explanation = response.text?.trim() || `Chính xác! Đáp án đúng là ${answer}.`;
    res.json({ success: true, explanation });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Lỗi tạo lời giải thích",
      fallback: `Chính xác! Đáp án đúng là phương án ${req.body.answer || ""}.`,
    });
  }
});

// Setup Vite or Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Lớp Học Vui] Máy chủ chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer();
