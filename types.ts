
export enum AssetType {
  PRODUCT = 'product',
  CONTEXT = 'context'
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface AnalysisResult {
  subjects: string;
  lighting: string;
  details: string;
  quality: string;
  brandVibe: string;
  suggestedPrompt: string;
}

export interface MarketingCopy {
  headline: string;
  body: string;
  cta: string;
}

export type AspectRatio = 
  | 'Instagram Square (1:1)' 
  | 'Instagram Portrait (4:5)' 
  | 'Instagram Story (9:16)' 
  | 'Facebook Feed (16:9)'
  | 'Facebook Cover (16:9)' 
  | 'YouTube Thumbnail (16:9)'
  | 'LinkedIn Feed (4:5)'
  | 'Custom Size';

export interface HistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  copy: MarketingCopy | null;
  ratio: AspectRatio;
  width?: number;
  height?: number;
  timestamp: number;
}
