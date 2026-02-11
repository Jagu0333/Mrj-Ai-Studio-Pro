
// @ts-nocheck
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Asset, AnalysisResult, MarketingCopy, AspectRatio } from "../types";

// Always use new GoogleGenAI({ apiKey: process.env.API_KEY }) directly as per coding guidelines
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 5000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.message?.includes("429")) {
      console.warn(`Quota exceeded. Cooling down for ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const sanitizeError = (err: any): string => {
  const msg = err?.message || "";
  if (msg.includes("429")) return "QUOTA_EXCEEDED";
  if (msg.includes("403") || msg.includes("401") || msg.includes("permission denied")) 
    return "PERMISSION_DENIED: High-Res requires an active API key selection.";
  return "STUDIO_INTERRUPTION: " + msg;
};

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const calculateBestAspectRatio = (w: number, h: number): string => {
  const ratio = w / h;
  const targets = [
    { name: "1:1", val: 1 },
    { name: "4:3", val: 4/3 },
    { name: "3:4", val: 3/4 },
    { name: "16:9", val: 16/9 },
    { name: "9:16", val: 9/16 }
  ];
  
  let closest = targets[0];
  let minDiff = Math.abs(ratio - closest.val);
  
  for (const target of targets) {
    const diff = Math.abs(ratio - target.val);
    if (diff < minDiff) {
      minDiff = diff;
      closest = target;
    }
  }
  return closest.name;
};

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
      if (!ctx) return reject("Canvas context failed");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      const targetMimeType = 'image/jpeg';
      const compressedDataUrl = canvas.toDataURL(targetMimeType, 0.85);
      resolve({ base64: compressedDataUrl.split(',')[1], url: compressedDataUrl, mimeType: targetMimeType });
    };
    img.onerror = () => reject("Failed to load image");
  });
};

export const performCreativeDeepDive = async (assets: Asset[]): Promise<{ analysis: AnalysisResult, copy: MarketingCopy }> => {
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
            { text: "ACT AS WORLD-CLASS CREATIVE DIRECTOR: Conduct visual DNA analysis. 1) Synthesize photorealistic prompt. 2) Generate high-conversion viral copy (Headline, Social Body, CTA)." }
          ]
        },
        config: {
          systemInstruction: "Provide high-end marketing metadata as a JSON object.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.OBJECT,
                properties: {
                  subjects: { type: Type.STRING },
                  lighting: { type: Type.STRING },
                  brandVibe: { type: Type.STRING },
                  suggestedPrompt: { type: Type.STRING }
                },
                required: ["subjects", "lighting", "brandVibe", "suggestedPrompt"]
              },
              copy: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  body: { type: Type.STRING },
                  cta: { type: Type.STRING }
                },
                required: ["headline", "body", "cta"]
              }
            },
            required: ["analysis", "copy"]
          },
          safetySettings: SAFETY_SETTINGS
        }
      });
      const data = JSON.parse(response.text || "{}");
      return { analysis: data.analysis, copy: data.copy };
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
        contents: `Elevate this prompt into a technical high-fidelity directive: "${prompt}"`,
        config: {
          systemInstruction: "Output only the raw, refined prompt text. No filler.",
          safetySettings: SAFETY_SETTINGS
        }
      });
      return response.text?.trim() || prompt;
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};

export const isolateSubject = async (asset: Asset): Promise<{ base64: string, url: string }> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const isolationNormalized = await compressImage(asset.base64, asset.mimeType, 512);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: isolationNormalized.base64, mimeType: isolationNormalized.mimeType } },
            { text: "ISOLATION: Remove background." }
          ]
        },
        config: { safetySettings: SAFETY_SETTINGS }
      });

      let base64 = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const p of parts) { if (p.inlineData) { base64 = p.inlineData.data; break; } }
      if (!base64) return { base64: asset.base64, url: asset.url };
      return { base64, url: `data:image/png;base64,${base64}` };
    } catch (err) {
      return { base64: asset.base64, url: asset.url };
    }
  });
};

export const generatePoster = async (
  assets: Asset[], 
  prompt: string, 
  ratio: AspectRatio,
  bgRemoval: boolean,
  copy?: MarketingCopy | null,
  customWidth?: number,
  customHeight?: number,
  isHighRes?: boolean
): Promise<string> => {
  return withRetry(async () => {
    try {
      const ai = getAI();
      const assetParts = assets.map((a, i) => {
        const data = (bgRemoval && a.isolatedBase64) ? a.isolatedBase64 : a.base64;
        return [
          { inlineData: { data, mimeType: 'image/png' } },
          { text: `BRAND ASSET ${i + 1}: High-fidelity preservation. Maintain exact colors and object geometry.` }
        ];
      }).flat();

      let targetRatio = '1:1';
      let dimensionInstruction = '';

      if (ratio === 'Custom Size' && customWidth && customHeight) {
        targetRatio = calculateBestAspectRatio(customWidth, customHeight);
        dimensionInstruction = `MANDATORY GEOMETRY: Compose this poster for exactly ${customWidth}x${customHeight} pixels. Adjust all whitespace, text placement, and asset scaling to fit this specific high-resolution layout perfectly. Do not deviate from this aspect ratio.`;
      } else {
        const supportedRatios: Record<string, string> = {
          'Instagram Square (1:1)': '1:1', 'Instagram Portrait (4:5)': '3:4', 'Instagram Story (9:16)': '9:16', 
          'Facebook Feed (16:9)': '16:9', 'Facebook Cover (16:9)': '16:9', 'YouTube Thumbnail (16:9)': '16:9',
          'LinkedIn Feed (4:5)': '3:4'
        };
        targetRatio = supportedRatios[ratio] || '1:1';
      }
      
      const headlineInstr = copy?.headline?.trim() 
        ? `INTEGRATED HEADLINE: Render text "${copy.headline}" using clean, premium branding typography.` 
        : "TEXTUAL CONSTRAINT: Do not include any headline text.";
      const ctaInstr = copy?.cta?.trim() 
        ? `INTEGRATED CTA: Create a sleek call-to-action button or text: "${copy.cta}".` 
        : "TEXTUAL CONSTRAINT: Do not include any CTA text.";

      const finalPrompt = `MASTER AD SYNTHESIS: ${prompt}. ${dimensionInstruction} ${headlineInstr} ${ctaInstr}. Position marketing copy in optimal negative space. Adhere to premium brand aesthetic. Ensure subjects are front-and-center. Render for a ${targetRatio} composition with maximum pixel density.`;

      // Dual-Model Routing
      const selectedModel = isHighRes ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: { parts: [...assetParts, { text: finalPrompt }] },
        config: {
          imageConfig: { 
            aspectRatio: targetRatio as any,
            ...(isHighRes ? { imageSize: "4K" } : {})
          },
          safetySettings: SAFETY_SETTINGS
        }
      });

      let imageUrl = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const p of parts) { if (p.inlineData) { imageUrl = `data:image/png;base64,${p.inlineData.data}`; break; } }
      if (!imageUrl) throw new Error("GEN_FAIL");
      return imageUrl;
    } catch (error) {
      throw new Error(sanitizeError(error));
    }
  });
};
