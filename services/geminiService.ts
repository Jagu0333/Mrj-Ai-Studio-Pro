// @ts-nocheck
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Asset, AnalysisResult, MarketingCopy, AspectRatio } from "../types";

/**
 * GLOBAL API CALL COUNTER
 * Tracks every call to the Gemini model for debugging purposes.
 */
let apiCallCount = 0;

const logApiCall = () => {
  apiCallCount++;
  console.log(`Gemini call started — count: ${apiCallCount}`);
};

/**
 * GLOBAL CLIENT-SIDE RATE LIMITER
 * Persists in memory during the session.
 */
let lastImageRequestTime = 0;
let lastTextRequestTime = 0;

const IMAGE_COOLDOWN = 60000; // 60 seconds
const TEXT_COOLDOWN = 20000;  // 20 seconds

const enforceRateLimit = (type: 'text' | 'image') => {
  const now = Date.now();
  if (type === 'image') {
    if (now - lastImageRequestTime < IMAGE_COOLDOWN) {
      throw new Error("Please wait before generating again.");
    }
    lastImageRequestTime = now;
  } else {
    if (now - lastTextRequestTime < TEXT_COOLDOWN) {
      throw new Error("Please wait before generating again.");
    }
    lastTextRequestTime = now;
  }
};

/**
 * SECURE INITIALIZATION
 */
const getAI = () => {
  if (!process.env.API_KEY || process.env.API_KEY === "undefined") {
    throw new Error("STUDIO_CONFIG_ERROR: Secure environment key is missing.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * STRICT ONE-SHOT ERROR HANDLING
 * All retry, backoff, and queueing logic is removed.
 * Returns immediate failure messages.
 */
const sanitizeError = (err: any): string => {
  // If it's our own rate limit error, preserve it
  if (err.message === "Please wait before generating again.") {
    return err.message;
  }

  const errorString = JSON.stringify(err).toLowerCase();
  
  // Specific Quota Failure Message
  if (errorString.includes("429") || errorString.includes("quota") || errorString.includes("exhausted") || errorString.includes("limit")) {
    return "Quota or capacity reached. Please try later.";
  }
  
  if (errorString.includes("safety") || errorString.includes("blocked")) {
    return "Safety filter triggered. Please adjust assets or prompt.";
  }
  
  return err.message || "Studio connectivity interrupted.";
};

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

export const compressImage = (base64: string, mimeType: string, maxDim: number = 1024): Promise<{ base64: string, url: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `data:${mimeType};base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) { height *= maxDim / width; width = maxDim; }
      } else {
        if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas failure");
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: compressedDataUrl.split(',')[1], url: compressedDataUrl, mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject("Load failure");
  });
};

/**
 * CONSOLIDATED CREATIVE ACTION: Analyzes assets and generates marketing copy in ONE call.
 */
export const getCreativeIntelligence = async (assets: Asset[]): Promise<{ analysis: AnalysisResult, copy: MarketingCopy }> => {
  try {
    enforceRateLimit('text');
    logApiCall();
    const ai = getAI();
    const parts = assets.map((asset) => ({ inlineData: { data: asset.base64, mimeType: asset.mimeType } }));
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          ...parts,
          { text: "SENIOR ART DIRECTOR AUDIT: Analyze these assets and synthesize an elite advertising suggestedPrompt. Also generate high-converting marketing copy (Headline, Social Body, CTA). RETURN JSON ONLY." }
        ]
      },
      config: {
        systemInstruction: "You are the Executive Creative Director. Output Analysis and Marketing Copy as a single JSON object. Preserve 100% asset fidelity in prompts.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: {
              type: Type.OBJECT,
              properties: {
                subjects: { type: Type.STRING },
                lighting: { type: Type.STRING },
                details: { type: Type.STRING },
                brandVibe: { type: Type.STRING },
                suggestedPrompt: { type: Type.STRING }
              },
              required: ["subjects", "lighting", "details", "brandVibe", "suggestedPrompt"]
            },
            copy: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                bodyCopy: { type: Type.STRING },
                cta: { type: Type.STRING }
              },
              required: ["headline", "bodyCopy", "cta"]
            }
          },
          required: ["analysis", "copy"]
        },
        safetySettings: SAFETY_SETTINGS
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { 
    throw new Error(sanitizeError(error)); 
  }
};

export const refinePrompt = async (prompt: string, assets: Asset[]): Promise<string> => {
  try {
    enforceRateLimit('text');
    logApiCall();
    const ai = getAI();
    const assetParts = assets.map((asset) => ({ inlineData: { data: asset.base64, mimeType: asset.mimeType } }));
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          ...assetParts,
          { text: `HEAD OF DESIGN REFINEMENT: Enhance this vision: "${prompt}". Focus on cinematic material physics. ONLY output the refined prompt text.` }
        ]
      },
      config: { 
        systemInstruction: "You are a Master Creative Director. Return raw prompt text only.",
        safetySettings: SAFETY_SETTINGS 
      }
    });
    return response.text?.trim() || prompt;
  } catch (error) {
    throw new Error(sanitizeError(error));
  }
};

export const isolateSubject = async (asset: Asset): Promise<{ base64: string, url: string }> => {
  try {
    enforceRateLimit('image');
    logApiCall();
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: asset.base64, mimeType: asset.mimeType } },
          { text: "PRECISION ISOLATION: Isolate subject, remove background. Transparent PNG." }
        ]
      },
      config: { safetySettings: SAFETY_SETTINGS }
    });
    let base64 = '';
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const p of parts) { if (p.inlineData) { base64 = p.inlineData.data; break; } }
    if (!base64) throw new Error("ISO_FAIL: No isolated image returned.");
    return { base64, url: `data:image/png;base64,${base64}` };
  } catch (err) { 
    throw new Error(sanitizeError(err)); 
  }
};

/**
 * GENERATE MASTERPIECE
 * Maps UI aspect ratios to Gemini API supported formats.
 * Custom maps to 16:9 as per the 1920x1080 UI label.
 */
export const generatePoster = async (
  assets: Asset[], 
  prompt: string, 
  ratio: AspectRatio,
  bgRemoval: boolean,
  marketingCopy?: MarketingCopy | null
): Promise<string> => {
  try {
    enforceRateLimit('image');
    logApiCall();
    const ai = getAI();
    const assetParts = assets.map((a) => {
      const data = (bgRemoval && a.isolatedBase64) ? a.isolatedBase64 : a.base64;
      return { inlineData: { data, mimeType: 'image/png' } };
    });

    const ratioMap: Record<string, string> = {
      'Instagram Square (1:1)': '1:1', 
      'Instagram Portrait (4:5)': '3:4', 
      'Instagram Story (9:16)': '9:16', 
      'Facebook Feed (16:9)': '16:9', 
      'Facebook Cover (16:9)': '16:9',
      'YouTube Thumbnail (16:9)': '16:9',
      'LinkedIn Feed (4:5)': '3:4',
      'Custom': '16:9' 
    };

    let targetRatio = ratioMap[ratio] || '1:1';
    const brandingText = (marketingCopy?.headline?.trim() || marketingCopy?.cta?.trim()) 
      ? `STRICT BRANDING: Integrate Headline: "${marketingCopy?.headline || ''}" and CTA: "${marketingCopy?.cta || ''}" using premium ad typography.` 
      : `STRICT REQUIREMENT: NO TEXT. Composition only.`;

    const finalPrompt = `VISION: ${prompt}. ${brandingText} STRICT FIDELITY: Use product images exactly. Composite with cinematic lighting. FORMAT: ${targetRatio}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [...assetParts, { text: finalPrompt }] },
      config: {
        imageConfig: { aspectRatio: targetRatio as any },
        safetySettings: SAFETY_SETTINGS
      }
    });

    let imageUrl = '';
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const p of parts) { if (p.inlineData) { imageUrl = `data:image/png;base64,${p.inlineData.data}`; break; } }
    if (!imageUrl) throw new Error("GEN_FAIL: Could not extract image.");
    return imageUrl;
  } catch (error) { 
    throw new Error(sanitizeError(error)); 
  }
};