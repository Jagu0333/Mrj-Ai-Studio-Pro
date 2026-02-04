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
 * UTILITY: Wrap a function with retry logic specifically for 429 (Quota) errors
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 5000): Promise<T> => {
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
      console.warn(`[Studio API] Quota reached. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const sanitizeError = (err: any): string => {
  const errorString = JSON.stringify(err).toLowerCase();
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
            { text: "SENIOR ART DIRECTOR SCAN: High-fidelity visual analysis. Identify product materials, brand colors, and typography. Generate a MASTERPIECE creative directive for a luxury agency. Use technical photography language (e.g. Phase One XF, 85mm Schneider lens, cinematic lighting). RETURN JSON ONLY." }
          ]
        },
        config: {
          systemInstruction: "You are an Elite Global Creative Director. You transform assets into world-class design directives.",
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
        contents: `USER INPUT: "${prompt}". 
        ACT AS: Head of Design & Senior Art Director. 
        TASK: Refine this into a professional, technically precise advertising directive. 
        INSTRUCTIONS: Use expert terminology for lighting (e.g., Rembrandt, Chiaroscuro), camera optics (e.g., f/1.8, bokeh depth), and high-end composition. Ensure the prompt describes an elite-quality commercial shoot suitable for a global luxury brand.`,
        config: {
          systemInstruction: "You are the Head of Design at a world-class agency. Refine user ideas into professional art-directed prompts. ONLY OUTPUT THE REFINED TEXT.",
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
        contents: `CREATIVE VISION: "${prompt}". 
        ROLE: Senior Copywriter & Social Media Strategist. 
        TASK: Generate viral, high-conversion marketing copy. 
        TONE: Sophisticated, persuasive, luxury-oriented. 
        OUTPUT: JSON with headline, caption, and cta.`,
        config: {
          systemInstruction: "You are a World-Class Copywriter. Your copy is elegant and high-impact.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              caption: { type: Type.STRING },
              cta: { type: Type.STRING }
            },
            required: ["headline", "caption", "cta"]
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
            { text: "Precision extraction: Isolate the primary product subject with perfect edge detection. Remove all background. Output on #FFFFFF canvas." }
          ]
        },
        config: { safetySettings: SAFETY_SETTINGS }
      });

      let isolatedBase64 = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) { isolatedBase64 = part.inlineData.data; break; }
      }
      if (!isolatedBase64) throw new Error("ISO_FAIL: Extraction failed.");
      return { base64: isolatedBase64, url: `data:image/png;base64,${isolatedBase64}` };
    } catch (err) {
      throw err;
    }
  });
};

export const generatePoster = async (
  assets: Asset[], 
  prompt: string, 
  ratio: AspectRatio,
  bgRemoval: boolean
): Promise<string> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const assetParts = assets.map((a) => {
        const data = (bgRemoval && a.isolatedBase64) ? a.isolatedBase64 : a.base64;
        return { inlineData: { data, mimeType: 'image/png' } };
      });

      const supportedRatios: Record<string, string> = {
        'Instagram Square (1:1)': '1:1', 
        'Instagram Portrait (4:5)': '3:4', 
        'Instagram Story (9:16)': '9:16', 
        'Facebook Feed (16:9)': '16:9', 
        'Facebook Cover (16:9)': '16:9',
        'YouTube Thumbnail (16:9)': '16:9',
        'LinkedIn Feed (4:5)': '3:4',
        'LinkedIn Header (16:9)': '16:9'
      };

      const targetRatio = supportedRatios[ratio] || '1:1';
      
      const finalPrompt = `ART DIRECTION: ${prompt}. 
      RETAIL COMPLIANCE: Use product's exact colors and textures. 
      COMPOSITION: Elite, agency-quality commercial ad. 
      FINISH: Seamless blending, realistic shadows, professional grading. 
      The final output must look like a high-end commercial poster from a top global agency. 
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
      
      if (!imageUrl) throw new Error("GEN_FAIL: Poster generation yielded no visual.");
      return imageUrl;
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};
