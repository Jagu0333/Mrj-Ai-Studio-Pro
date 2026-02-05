// @ts-nocheck
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Asset, AnalysisResult, CreativePrompt, MarketingCopy, AspectRatio } from "../types";

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
 * UTILITY: Enhanced retry logic for Gemini Quota (429) errors.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 15000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorString = JSON.stringify(error).toLowerCase();
    const isQuotaError = 
      error.message?.includes("429") || 
      error.status === 429 || 
      errorString.includes("429") || 
      errorString.includes("quota") || 
      errorString.includes("resource_exhausted");

    if (retries > 0 && isQuotaError) {
      console.warn(`[Studio API] Quota reached. Retrying in ${delay}ms... Attempts left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
};

const sanitizeError = (err: any): string => {
  const errorString = JSON.stringify(err).toLowerCase();
  
  // Specific handling for Permission Denied which is common with Gemini 2.5 series
  if (errorString.includes("permission_denied") || errorString.includes("403")) {
    return "ACCESS_DENIED: Background removal requires an API key from a PAID Google Cloud Project with the Gemini API enabled. Please ensure your project has billing enabled at ai.google.dev/gemini-api/docs/billing.";
  }
  
  if (errorString.includes("429") || errorString.includes("quota")) {
    return "GEMINI_QUOTA: API capacity reached. Retrying automatically...";
  }
  
  return err.message || "STUDIO_ERROR: Something went wrong with the AI engine.";
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
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas context failed");
      ctx.drawImage(img, 0, 0, width, height);
      const targetMimeType = 'image/jpeg';
      const compressedDataUrl = canvas.toDataURL(targetMimeType, 0.85);
      const compressedBase64 = compressedDataUrl.split(',')[1];
      resolve({ base64: compressedBase64, url: compressedDataUrl, mimeType: targetMimeType });
    };
    img.onerror = () => reject("Failed to load image for compression");
  });
};

export const analyzeAssets = async (assets: Asset[]): Promise<AnalysisResult> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const parts = assets.map((asset) => ({
        inlineData: { data: asset.base64, mimeType: asset.mimeType }
      }));
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            ...parts,
            { text: "SENIOR ART DIRECTOR INTELLIGENT SCAN: Analyze visual DNA. Synthesize a luxury-grade suggestedPrompt. IMPORTANT: DO NOT include any text or branding instructions. Focus strictly on visual composition and lighting. RETURN JSON ONLY." }
          ]
        },
        config: {
          systemInstruction: "You are an Elite Global Creative Director. Output JSON identifying subjects and a premium photographic suggestedPrompt with NO mention of text or copy.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjects: { type: Type.STRING },
              lighting: { type: Type.STRING },
              details: { type: Type.STRING },
              quality: { type: Type.STRING },
              brandVibe: { type: Type.STRING },
              suggestedPrompt: { type: Type.STRING }
            },
            required: ["subjects", "lighting", "details", "quality", "brandVibe", "suggestedPrompt"]
          },
          safetySettings: SAFETY_SETTINGS
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};

export const refinePrompt = async (prompt: string): Promise<string> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `USER INPUT: "${prompt}". Refine into technically precise, elite advertising directive. NO TEXT INSTRUCTIONS.`,
        config: {
          systemInstruction: "Refine prompts with high-end photographic terms. NO TEXT OR TYPOGRAPHY. ONLY OUTPUT TEXT.",
          safetySettings: SAFETY_SETTINGS
        }
      });
      return response.text?.trim() || prompt;
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};

export const generateMarketingCopy = async (prompt: string): Promise<MarketingCopy> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `VISION: "${prompt}". Generate excellent Hook, Social Body Copy, and CTA. JSON ONLY.`,
        config: {
          systemInstruction: "You are a World-Class Creative Copywriter. Produce high-end copy. RETURN JSON ONLY.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              bodyCopy: { type: Type.STRING },
              cta: { type: Type.STRING }
            },
            required: ["headline", "bodyCopy", "cta"]
          },
          safetySettings: SAFETY_SETTINGS
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};

export const isolateSubject = async (asset: Asset): Promise<{ base64: string, url: string }> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: asset.base64, mimeType: asset.mimeType } },
            { text: "CORE DIRECTIVE: Remove the background with absolute precision. Isolate only the primary subject. The output MUST be a PNG image with a fully transparent (alpha) background. Ensure edges are crisp and clean for high-end studio compositing. Do not add any shadows or backgrounds." }
          ]
        },
        config: { safetySettings: SAFETY_SETTINGS }
      });

      let isolatedBase64 = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) { isolatedBase64 = part.inlineData.data; break; }
      }
      if (!isolatedBase64) throw new Error("ISO_FAIL");
      return { base64: isolatedBase64, url: `data:image/png;base64,${isolatedBase64}` };
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });
};

export const generatePoster = async (
  assets: Asset[], 
  prompt: string, 
  ratio: AspectRatio,
  bgRemoval: boolean,
  marketingCopy?: MarketingCopy | null,
  customWidth?: number,
  customHeight?: number
): Promise<string> => {
  return withRetry(async () => {
    try {
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
        'LinkedIn Feed (4:5)': '3:4'
      };

      let targetRatio = ratioMap[ratio] || '1:1';
      let sizeInstruction = '';

      if (ratio === 'Custom' && customWidth && customHeight) {
        const ar = customWidth / customHeight;
        sizeInstruction = `PRODUCTION SIZE: ${customWidth}x${customHeight} pixels.`;
        if (ar === 1) targetRatio = '1:1';
        else if (ar < 1) targetRatio = ar <= 0.6 ? '9:16' : '3:4';
        else targetRatio = ar >= 1.5 ? '16:9' : '4:3';
      }
      
      let brandingText = '';
      const hasHeadline = marketingCopy?.headline?.trim();
      const hasCTA = marketingCopy?.cta?.trim();

      if (hasHeadline || hasCTA) {
        brandingText = `BRANDING: Integrate Headline: "${hasHeadline || ''}" and CTA: "${hasCTA || ''}" into the composition. Use product-matched typography.`;
      } else {
        brandingText = `STRICT REQUIREMENT: NO TEXT. DO NOT render any written words. Pure visual output only.`;
      }

      const finalPrompt = `
      CREATIVE VISION: ${prompt}. 
      ${brandingText}
      ${sizeInstruction}

      TASK: Composite provided assets into an elite commercial poster.
      FORMAT: ${targetRatio}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [...assetParts, { text: finalPrompt }]
        },
        config: {
          imageConfig: { aspectRatio: targetRatio as any },
          safetySettings: SAFETY_SETTINGS
        }
      });

      let imageUrl = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) { 
          imageUrl = `data:image/png;base64,${part.inlineData.data}`; 
          break; 
        }
      }
      
      if (!imageUrl) throw new Error("GEN_FAIL");
      return imageUrl;
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};