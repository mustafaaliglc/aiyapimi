import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildEnginePrompt,
  getAspectRatioDimensions,
  validatePrompt,
  enhancePromptLocally,
  maskApiKey,
} from './src/utils/prompt-helper';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Helper to get active Gemini client
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-promptcanvas/2.0',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const customKey = req.headers['x-gemini-api-key'] as string | undefined;
  const activeKey = customKey || process.env.GEMINI_API_KEY;
  const hasApiKey = Boolean(activeKey && activeKey !== 'MY_GEMINI_API_KEY');

  res.json({
    status: 'ok',
    hasApiKey,
    maskedKey: hasApiKey ? maskApiKey(activeKey) : undefined,
    time: new Date().toISOString(),
  });
});

// Prompt Enhancer with exponential backoff and smart local fallback
app.post('/api/enhance-prompt', async (req, res) => {
  try {
    const { prompt, style } = req.body;
    const validation = validatePrompt(prompt);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const customKey = req.headers['x-gemini-api-key'] as string | undefined;
    const ai = getGeminiClient(customKey);

    // If no API key configured, use local smart enhancer
    if (!ai) {
      const localResult = enhancePromptLocally(prompt, style);
      return res.json({
        success: true,
        enhancedPrompt: localResult.enhancedPrompt,
        suggestedStyle: localResult.suggestedStyle,
        explanationTr: 'API anahtarı bulunamadı; yerel akıllı motor isteminizi detaylandırdı ✨',
        isFallback: true,
      });
    }

    const systemInstruction = `You are an elite AI visual art director and prompt engineer.
Your task is to take an image prompt (Turkish or English) and expand it into a visually breathtaking, highly descriptive prompt optimized for generative diffusion models.
Preserve the user's core idea. Add specific visual layers: artistic medium, focal point, lighting (volumetric, rim light, golden hour, chiaroscuro), atmosphere, textural depth, color palette, and composition.
Suggest one matching style from: ['photorealistic', 'anime', 'digital-art', 'cyberpunk', '3d-render', 'watercolor', 'fantasy', 'pixel-art', 'general'].
Respond strictly in JSON matching the schema.`;

    let responseText = '';
    let callSucceeded = false;

    // Retry loop for transient 429 / rate limits
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Enhance this image prompt for maximum aesthetic beauty: "${prompt}"`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                enhancedPrompt: {
                  type: Type.STRING,
                  description: 'The rich, highly detailed English prompt for image generation',
                },
                suggestedStyle: {
                  type: Type.STRING,
                  description: 'The suggested style id from the allowed list',
                },
                explanationTr: {
                  type: Type.STRING,
                  description: 'Bir cümlelik Türkçe özet açıklama',
                },
              },
              required: ['enhancedPrompt'],
            },
          },
        });

        responseText = response.text?.trim() || '';
        callSucceeded = true;
        break;
      } catch (err: any) {
        const errMsg = err?.message || '';
        const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
        if (isRateLimit && attempt === 0) {
          // Wait 1.5 seconds before retrying
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        // If second attempt or other error, break to fallback
        break;
      }
    }

    if (callSucceeded && responseText) {
      try {
        const parsed = JSON.parse(responseText);
        return res.json({
          success: true,
          enhancedPrompt: parsed.enhancedPrompt || prompt,
          suggestedStyle: parsed.suggestedStyle || style || 'general',
          explanationTr: parsed.explanationTr || 'İstem Gemini 3.8 Flash ile sanatsal detaylarla zenginleştirildi ✨',
          isFallback: false,
        });
      } catch {
        // JSON parse issue, fall through to local enhancer
      }
    }

    // Graceful fallback: 429 or quota limit reached, do not fail
    const localResult = enhancePromptLocally(prompt, style);
    return res.json({
      success: true,
      enhancedPrompt: localResult.enhancedPrompt,
      suggestedStyle: localResult.suggestedStyle,
      explanationTr: localResult.explanationTr,
      isFallback: true,
    });
  } catch (error: any) {
    console.error('Enhance prompt error:', error?.message);
    const localResult = enhancePromptLocally(req.body?.prompt || 'görsel', req.body?.style);
    return res.json({
      success: true,
      enhancedPrompt: localResult.enhancedPrompt,
      suggestedStyle: localResult.suggestedStyle,
      explanationTr: 'Otomatik yerel iyileştirme uygulandı ✨',
      isFallback: true,
    });
  }
});

// Helper to fetch image buffer with timeout and custom headers
async function fetchImageBuffer(url: string, timeoutMs: number = 25000): Promise<{ buffer: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://pollinations.ai/',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`Image fetch failed with status: ${res.status} (${res.statusText})`);
      return null;
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.warn(`Received non-image content type: ${contentType}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  } catch (err: any) {
    clearTimeout(timer);
    console.warn(`Image fetch exception: ${err?.message}`);
    return null;
  }
}

// Procedural SVG fallback generator (guarantees an image is always returned even if all networks fail)
function generateProceduralFallbackSvg(prompt: string, style: string, width: number, height: number): string {
  const escapedPrompt = prompt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 120);

  const colors = {
    cyberpunk: ['#0f051d', '#2e0854', '#00f0ff', '#ff007f'],
    anime: ['#0f172a', '#1e293b', '#38bdf8', '#f43f5e'],
    fantasy: ['#1c1917', '#292524', '#eab308', '#a855f7'],
    general: ['#090d16', '#1e1b4b', '#6366f1', '#ec4899'],
  }[style] || ['#090d16', '#1e1b4b', '#6366f1', '#ec4899'];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors[0]}"/>
      <stop offset="50%" stop-color="${colors[1]}"/>
      <stop offset="100%" stop-color="${colors[0]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${colors[2]}" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="${colors[3]}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="${width / 2}" cy="${height / 2 - 40}" r="${Math.min(width, height) * 0.35}" fill="url(#glow)" />
  <g fill="none" stroke="${colors[2]}" stroke-width="1.5" opacity="0.3">
    <circle cx="${width / 2}" cy="${height / 2 - 40}" r="${Math.min(width, height) * 0.2}" />
    <circle cx="${width / 2}" cy="${height / 2 - 40}" r="${Math.min(width, height) * 0.3}" stroke-dasharray="8 6"/>
  </g>
  <text x="50%" y="${height / 2 - 40}" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">
    PromptCanvas AI
  </text>
  <text x="50%" y="${height / 2 + 10}" font-family="system-ui, sans-serif" font-size="14" fill="${colors[2]}" text-anchor="middle">
    ${style.toUpperCase()} • SANATSAL TUVAL
  </text>
  <rect x="${width * 0.1}" y="${height - 110}" width="${width * 0.8}" height="70" rx="14" fill="#020617" fill-opacity="0.8" stroke="#334155" stroke-width="1"/>
  <text x="50%" y="${height - 70}" font-family="system-ui, sans-serif" font-size="13" fill="#cbd5e1" text-anchor="middle">
    "${escapedPrompt}..."
  </text>
</svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Resilient Image Generation API with Multi-Engine Fallback Chain
app.post('/api/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      style = 'general',
      aspectRatio = '1:1',
      seed = Math.floor(Math.random() * 1000000),
      engine = 'turbo',
      negativePrompt,
    } = req.body;

    const validation = validatePrompt(prompt);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const enginePrompt = buildEnginePrompt(prompt, style, negativePrompt);
    const { width, height } = getAspectRatioDimensions(aspectRatio);
    const encodedPrompt = encodeURIComponent(enginePrompt);

    // Engine candidates to try in order (prevents 402/503 breakdown)
    const engineAttempts: { name: string; url: string }[] = [];

    if (engine === 'flux') {
      engineAttempts.push({
        name: 'Flux Sanat Motoru',
        url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`,
      });
    }

    // Always include Turbo engine (free, reliable, no 402 payment barrier)
    engineAttempts.push({
      name: 'Turbo Neural Motor',
      url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=turbo`,
    });

    // Default pollinations model
    engineAttempts.push({
      name: 'Neural Standart Motor',
      url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`,
    });

    let finalImageUrl: string | null = null;
    let successfulEngine = 'AI Neural Studio';
    let fallbackUsed = false;

    for (let i = 0; i < engineAttempts.length; i++) {
      const attempt = engineAttempts[i];
      const result = await fetchImageBuffer(attempt.url, 18000);

      if (result && result.buffer.length > 5000) {
        finalImageUrl = `data:${result.contentType};base64,${result.buffer.toString('base64')}`;
        successfulEngine = attempt.name;
        fallbackUsed = i > 0;
        break;
      }
    }

    // Indestructible safety net if external networks hit 503 or offline
    if (!finalImageUrl) {
      console.warn('External engines unavailable, rendering procedural fallback visual');
      finalImageUrl = generateProceduralFallbackSvg(prompt, style, width, height);
      successfulEngine = 'PromptCanvas Çevrimdışı Görsel Tuvali';
      fallbackUsed = true;
    }

    return res.json({
      success: true,
      imageUrl: finalImageUrl,
      prompt: enginePrompt,
      originalPrompt: prompt,
      style,
      aspectRatio,
      engine: successfulEngine,
      seed,
      dimensions: { width, height },
      fallbackUsed,
      message: fallbackUsed ? 'Görsel sağlayıcı kotası dengelendi; alternatif motor ile başarıyla üretildi.' : undefined,
    });
  } catch (error: any) {
    console.error('Generate image error:', error?.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Görsel üretilirken bir hata oluştu.',
    });
  }
});

// Setup server and Vite integration
const httpServer = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer, // Crucial: attaches Vite HMR to HTTP server to prevent port 24678 timeout
      },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

httpServer.listen(PORT, () => {
  console.log(`PromptCanvas server listening on http://localhost:${PORT}`);
});
