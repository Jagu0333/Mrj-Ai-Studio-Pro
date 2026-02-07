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
  if (err.message === "Please wait before generating again.") {
    return err.message;
  }

  const errorString = JSON.stringify(err).toLowerCase();
  
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
        systemInstruction: "You are the Executive Creative Director. Output Analysis and Marketing Copy as a single JSON object. Preserve 100% asset fidelity in prompts. These are the EXACT assets that must be used in the final composition.",
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
          { text: `HEAD OF DESIGN REFINEMENT: Enhance this vision: "${prompt}". Focus on cinematic material physics. ONLY output the refined prompt text. Ensure the original objects provided in the parts are the central focus.` }
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
          { text: "PRECISION ISOLATION: Remove the background perfectly. Output a transparent PNG of the main subject. Do not change the subject's appearance, only remove the surroundings." }
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
 */
export const generatePoster = async (
  assets: Asset[], 
  prompt: string, 
  ratio: AspectRatio,
  bgRemoval: boolean,
  marketingCopy?: MarketingCopy | null,
  customDims?: { width: number, height: number }
): Promise<string> => {
  try {
    enforceRateLimit('image');
    logApiCall();
    const ai = getAI();
    const assetParts = assets.map((a) => {
      const isUsingIsolated = bgRemoval && a.isolatedBase64;
      const data = isUsingIsolated ? a.isolatedBase64 : a.base64;
      const mimeType = isUsingIsolated ? 'image/png' : a.mimeType;
      return { inlineData: { data, mimeType } };
    });

    const ratioMap: Record<string, string> = {
      'Instagram Square (1:1)': '1:1', 
      'Instagram Portrait (4:5)': '3:4', 
      'Instagram Story (9:16)': '9:16', 
      'Facebook Feed (16:9)': '16:9', 
      'Facebook Cover (16:9)': '16:9',
      'YouTube Thumbnail (16:9)': '16:9',
      'LinkedIn Feed (4:5)': '3:4'
    };

    let targetRatio = '1:1';
    if (ratio === 'Custom' && customDims) {
      const val = customDims.width / customDims.height;
      if (val >= 1.7) targetRatio = '16:9';
      else if (val >= 1.3) targetRatio = '4:3';
      else if (val >= 0.9) targetRatio = '1:1';
      else if (val >= 0.7) targetRatio = '3:4';
      else targetRatio = '9:16';
    } else {
      targetRatio = ratioMap[ratio] || '1:1';
    }

    const brandingText = (marketingCopy?.headline?.trim() || marketingCopy?.cta?.trim()) 
      ? `STRICT BRANDING: Integrate Headline: "${marketingCopy?.headline || ''}" and CTA: "${marketingCopy?.cta || ''}" using premium ad typography.` 
      : `STRICT REQUIREMENT: NO TEXT. Composition only.`;

    // Stronger system directive for fidelity
    const finalPrompt = `ASSET FIDELITY DIRECTIVE: You MUST use the visual features (textures, colors, shapes) of the provided image parts EXACTLY as they appear. 
    SCENE: ${prompt}. 
    ${brandingText} 
    COMPOSITION: Professional advertising photography with cinematic lighting. Ensure the product and environment from the parts are merged seamlessly while maintaining their original identity. 
    FORMAT: ${targetRatio}`;

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