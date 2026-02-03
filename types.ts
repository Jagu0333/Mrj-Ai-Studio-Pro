
export enum AssetType {
  PRODUCT = 'product',
  MODEL = 'model'
}

export interface Asset {
  id: string;
  url: string;
  base64: string;
  isolatedUrl?: string;
  isolatedBase64?: string;
  type: AssetType;
  name: string;
  mimeType: string;
}

export interface AnalysisResult {
  subjects: string;
  lighting: string;
  details: string;
  quality: string;
  brandVibe: string;
  suggestedPrompt: string;
}

export interface CreativePrompt {
  id: string;
  title: string;
  description: string;
  vibe: 'luxury' | 'emotional' | 'bold' | 'cinematic' | 'minimal';
}

export interface MarketingCopy {
  headline: string;
  caption: string;
  cta: string;
}

export type AspectRatio = 
  | 'Instagram Post (1:1)' 
  | 'Instagram Portrait (4:5)' 
  | 'Instagram Reel (9:16)' 
  | 'Facebook Post (16:9)' 
  | 'YouTube Thumbnail (16:9)';

export interface HistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  copy: MarketingCopy | null;
  ratio: AspectRatio;
  timestamp: number;
}
