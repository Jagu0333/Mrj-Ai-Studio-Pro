
// @ts-nocheck
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Asset, AnalysisResult, CreativePrompt, MarketingCopy, AspectRatio } from "../types";

/**
 * SECURE INITIALIZATION
 */
const getAI = () => {
  const key = process.env.API_KEY;
  if (!key || key === "undefined") {
    throw new Error("STUDIO_CONFIG_ERROR: Secure environment key is missing.");
  }
  return new GoogleGenAI({ apiKey: key });
};

/**
 * GLOBAL ERROR SANITIZER
 */
const sanitizeError = (err: any): string => {
  const msg = err?.message || "";
  if (msg.includes("429")) return "QUOTA_EXHAUSTED: Studio capacity reached. Please wait a minute.";
  if (msg.includes("403") || msg.includes("401")) return "SECURITY_BLOCK: Access declined. Please check API credentials.";
  return "STUDIO_INTERRUPTION: An unexpected error occurred. Technical details scrubbed for safety.";
};

/**
 * RETAIL COMPLIANCE (PHOTOREALISTIC)
 */
export const sanitizeForRetail = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/lingerie|bra|panty|underwear/gi, "premium lifestyle apparel")
    .trim();
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
      const compressedDataUrl = canvas.toDataURL(targetMimeType, 0.8);
      const compressedBase64 = compressedDataUrl.split(',')[1];
      resolve({ base64: compressedBase64, url: compressedDataUrl, mimeType: targetMimeType });
    };
    img.onerror = () => reject("Failed to load image for compression");
  });
};

export const analyzeAssets = async (assets: Asset[]): Promise<AnalysisResult> => {
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
          { text: "SENIOR ART DIRECTOR SCAN: Perform a deep analysis of these visual assets. Identify every subject, the primary color palette, and the specific material textures. Create a photorealistic advertising vision. RETURN JSON ONLY." }
        ]
      },
      config: {
        systemInstruction: `You are the Head of Global Design. Your mission is to provide technical brand metadata.
        - Identify Colors: List primary colors.
        - Create Vision: The 'suggestedPrompt' MUST be a photorealistic scene combining ALL uploaded subjects.
        - NO MESH/WIREFRAME. NO AI SLANG. 100% COMMERCIAL PHOTOGRAPHY QUALITY.`,
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
};

export const refinePrompt = async (prompt: string, analysis?: AnalysisResult | null): Promise<string> => {
  try {
    const ai = getAI();
    const contents = analysis 
      ? `Using the Analysis Context (Subjects: ${analysis.subjects}), refine this user vision for viral aesthetic: "${prompt}"`
      : `Refine this creative vision for a photorealistic ad: "${prompt}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: "You are the Senior Executive Art Director. Rewrite the prompt for absolute photorealism. OUTPUT ONLY THE REFINED PROMPT TEXT. NO HEADINGS. NO INTROS. NO QUOTES.",
        safetySettings: SAFETY_SETTINGS
      }
    });
    return response.text?.trim().replace(/^['"]|['"]$/g, '') || prompt;
  } catch (error) {
    throw new Error(sanitizeError(error));
  }
};

export const generateMarketingCopy = async (prompt: string, analysis?: AnalysisResult | null): Promise<MarketingCopy> => {
  try {
    const ai = getAI();
    const context = analysis ? `Product/Subject Analysis: ${analysis.subjects}. Tone: ${analysis.brandVibe}. Vision: ${prompt}.` : `Vision: ${prompt}.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${context} Generate viral-worthy advertising copy. Return JSON: {headline, caption, cta}.`,
      config: {
        systemInstruction: `You are a World-Class Viral Copywriter. 
        - headline: Catchy, short, bold headline.
        - caption: Engaging social media caption (Instagram/TikTok style) with emojis, optimized for engagement.
        - cta: Powerful call to action (e.g., 'Shop the Collection', 'Transform Your Space').
        Return JSON.`,
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
};

export const isolateSubject = async (asset: Asset): Promise<{ base64: string, url: string }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: asset.base64, mimeType: asset.mimeType } },
          { text: "PRODUCTION TOOL: Extract and isolate the primary subject with perfect edge detection. DO NOT REMOVE any important parts. Pure white background #FFFFFF." }
        ]
      },
      config: { safetySettings: SAFETY_SETTINGS }
    });

    let isolatedBase64 = '';
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        isolatedBase64 = part.inlineData.data;
        break;
      }
    }
    return isolatedBase64 ? { base64: isolatedBase64, url: `data:image/png;base64,${isolatedBase64}` } : { base64: asset.base64, url: asset.url };
  } catch (err) {
    return { base64: asset.base64, url: asset.url };
  }
};

export const generatePoster = async (
  assets: Asset[], 
  prompt: string, 
  ratio: AspectRatio,
  bgRemoval: boolean,
  copy?: MarketingCopy | null
): Promise<string> => {
  try {
    const ai = getAI();
    const assetParts = assets.map((a) => {
      const data = (bgRemoval && a.isolatedBase64) ? a.isolatedBase64 : a.base64;
      return { inlineData: { data, mimeType: 'image/png' } };
    });

    const supportedRatios: Record<string, string> = {
      'Instagram Post (1:1)': '1:1', 
      'Instagram Portrait (4:5)': '3:4', // Best fit for 4:5 in Gemini
      'Instagram Reel (9:16)': '9:16', 
      'Facebook Post (16:9)': '16:9', 
      'YouTube Thumbnail (16:9)': '16:9'
    };

    const targetRatio = supportedRatios[ratio] || '1:1';

    const finalPrompt = `PRODUCTION SOURCE: Use the exact subjects provided.
    VISION: ${prompt}
    ART DIRECTION: Composite all uploaded subjects seamlessly into a high-end, 8k photorealistic photography advertisement.
    ${(copy && copy.headline) ? `BRANDING: Subtly integrate headline: "${copy.headline}" and CTA: "${copy.cta}"` : ""}
    MANDATORY: NO WIREFRAMES. NO MESHES. 100% REAL PHOTOGRAPHY.
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
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`; 
        break; 
      }
    }
    
    if (!imageUrl) throw new Error("RETAIL_POLICY_REJECTION");
    return imageUrl;
  } catch (error) {
    throw new Error(sanitizeError(error));
  }
};
