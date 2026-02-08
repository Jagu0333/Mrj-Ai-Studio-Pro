
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  RefreshCw, 
  Zap, 
  Monitor,
  Download,
  History,
  X,
  PlusCircle,
  BrainCircuit,
  AlertCircle,
  Moon,
  Sun,
  Layers,
  Maximize,
  Minimize,
  Edit3,
  Smartphone,
  CheckCircle2,
  Clock,
  Loader2,
  Megaphone,
  ShieldAlert,
  Trash2,
  Eraser,
  Undo2,
  Wand2,
  Cpu,
  Key
} from 'lucide-react';
import { 
  Asset, 
  AssetType, 
  MarketingCopy, 
  AspectRatio,
  HistoryItem
} from './types';
import * as gemini from './services/geminiService';
import * as db from './services/dbService';

const LOADING_MESSAGES = [
  "Analyzing visual DNA...",
  "Applying Art Director's vision...",
  "Synthesizing material physics...",
  "Aligning brand typography...",
  "Color grading textures...",
  "Polishing pixel-perfect details..."
];

const RATIO_OPTIONS: { label: AspectRatio; icon: any; sub: string }[] = [
  { label: 'Instagram Square (1:1)', icon: Layers, sub: '1:1' },
  { label: 'Instagram Portrait (4:5)', icon: Smartphone, sub: '4:5' },
  { label: 'Instagram Story (9:16)', icon: Smartphone, sub: '9:16' },
  { label: 'Facebook Feed (16:9)', icon: Monitor, sub: '16:9' },
  { label: 'Facebook Cover (16:9)', icon: Monitor, sub: '16:9' },
  { label: 'YouTube Thumbnail (16:9)', icon: Monitor, sub: '16:9' },
  { label: 'LinkedIn Feed (4:5)', icon: Layers, sub: '4:5' },
  { label: 'Custom Size', icon: Edit3, sub: 'USER DEFINED' },
];

const App: React.FC = () => {
  const [subjectAssets, setSubjectAssets] = useState<Asset[]>([]);
  const [contextAssets, setContextAssets] = useState<Asset[]>([]);
  const [isProcessingCreative, setIsProcessingCreative] = useState(false);
  const [isProcessingCopy, setIsProcessingCopy] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Instagram Square (1:1)');
  const [customWidth, setCustomWidth] = useState<number>(1920);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  const [marketingCopy, setMarketingCopy] = useState<MarketingCopy>({ headline: '', body: '', cta: '' });
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(true);
  const [isArtDirectorMode, setIsArtDirectorMode] = useState(false);
  const [isHighRes, setIsHighRes] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'preview'>('studio');
  const [error, setError] = useState<{ message: string; type: 'quota' | 'generic' } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('studio-theme') === 'dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [showKeySelectionOverlay, setShowKeySelectionOverlay] = useState(false);
  
  const isGenerating = isProcessingCreative || isProcessingCopy || isRefining || isGeneratingPoster || cooldownTime > 0;
  const allAssets = [...subjectAssets, ...contextAssets];

  useEffect(() => {
    loadHistory();
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studio-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studio-theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let interval: any;
    if (isGeneratingPoster) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGeneratingPoster]);

  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => setCooldownTime(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  const loadHistory = async () => setHistory(await db.getHistory());

  const handleOpenKeySelection = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setShowKeySelectionOverlay(false);
    }
  };

  const handleToggleHighRes = async () => {
    if (!isHighRes) {
      // Logic for 4K Premium Keyed Experience
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setShowKeySelectionOverlay(true);
          return;
        }
      }
    }
    setIsHighRes(!isHighRes);
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) await elem.requestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
      }
    } catch (e) { console.warn("FS_ERR", e); }
  }, []);

  const handleIsolateSubject = async (asset: Asset, type: AssetType) => {
    const setter = type === AssetType.PRODUCT ? setSubjectAssets : setContextAssets;
    setter(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'processing' } : a));
    try {
      const res = await gemini.isolateSubject(asset);
      setter(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'completed', isolatedBase64: res.base64, isolatedUrl: res.url } : a));
    } catch (err: any) {
      setter(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'failed' } : a));
      if (err.message?.includes("QUOTA")) {
        setError({ message: "Gemini capacity reached. Cooling down...", type: 'quota' });
        setCooldownTime(30);
      } else {
        setError({ message: err.message, type: 'generic' });
      }
    }
  };

  const processFiles = async (files: FileList, type: AssetType) => {
    setError(null);
    const newAssets: Asset[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const assetPromise = new Promise<Asset>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const rawBase64 = (reader.result as string).split(',')[1];
            const normalized = await gemini.compressImage(rawBase64, file.type, 1024);
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              url: normalized.url,
              base64: normalized.base64,
              type,
              name: file.name,
              mimeType: normalized.mimeType,
              status: 'pending'
            });
          } catch (e) { reject(e); }
        };
        reader.readAsDataURL(file);
      });
      const asset = await assetPromise;
      newAssets.push(asset);
    }
    
    const setter = type === AssetType.PRODUCT ? setSubjectAssets : setContextAssets;
    setter(prev => [...prev, ...newAssets]);

    if (bgRemovalEnabled) {
      for (const a of newAssets) {
        await handleIsolateSubject(a, type);
      }
    }
  };

  const handleSmartScan = async () => {
    if (isGenerating || allAssets.length === 0) return;
    setIsProcessingCreative(true);
    try {
      const data = await gemini.performCreativeDeepDive(allAssets);
      let prompt = data.analysis.suggestedPrompt;
      if (isArtDirectorMode) {
        setIsRefining(true);
        prompt = await gemini.refinePrompt(prompt);
        setIsRefining(false);
      }
      setSelectedPrompt(prompt);
    } catch (err: any) { 
      if (err.message?.includes("QUOTA")) {
        setError({ message: "Daily studio capacity reached.", type: 'quota' });
        setCooldownTime(30);
      } else {
        setError({ message: err.message, type: 'generic' });
      }
    }
    finally { 
      setIsProcessingCreative(false); 
      setIsRefining(false);
    }
  };

  const handleSmartCopy = async () => {
    if (isGenerating || allAssets.length === 0) return;
    setIsProcessingCopy(true);
    try {
      const data = await gemini.performCreativeDeepDive(allAssets);
      setMarketingCopy(data.copy);
    } catch (err: any) { 
      if (err.message?.includes("QUOTA")) {
        setError({ message: "Engine cooling down.", type: 'quota' });
        setCooldownTime(30);
      } else {
        setError({ message: err.message, type: 'generic' });
      }
    }
    finally { setIsProcessingCopy(false); }
  };

  const clearCopyOnly = () => {
    setMarketingCopy({ headline: '', body: '', cta: '' });
  };

  const handleRefinePrompt = async () => {
    if (isGenerating || !selectedPrompt) return;
    setIsRefining(true);
    try {
      setSelectedPrompt(await gemini.refinePrompt(selectedPrompt));
    } catch (err: any) { 
      if (err.message?.includes("QUOTA")) {
        setError({ message: "Refining engine throttled.", type: 'quota' });
        setCooldownTime(30);
      } else {
        setError({ message: err.message, type: 'generic' });
      }
    }
    finally { setIsRefining(false); }
  };

  const handleGeneratePoster = async () => {
    if (isGenerating || allAssets.length === 0 || !selectedPrompt) return;

    // Check for High-Res API key requirement
    if (isHighRes && window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setShowKeySelectionOverlay(true);
        return;
      }
    }

    setIsGeneratingPoster(true);
    setActiveTab('preview');
    try {
      const img = await gemini.generatePoster(
        allAssets, 
        selectedPrompt, 
        aspectRatio, 
        bgRemovalEnabled, 
        marketingCopy,
        customWidth,
        customHeight,
        isHighRes
      );
      setFinalImage(img);
      await db.saveHistoryItem({ 
          id: Math.random().toString(36).substr(2, 9), 
          imageUrl: img, 
          prompt: selectedPrompt, 
          copy: marketingCopy, 
          ratio: aspectRatio,
          timestamp: Date.now() 
      });
      loadHistory();
    } catch (err: any) { 
      if (err.message?.includes("QUOTA")) {
        setError({ message: "Poster printer exhausted.", type: 'quota' });
        setCooldownTime(60);
      } else {
        setError({ message: err.message, type: 'generic' });
      }
      setActiveTab('studio'); 
    }
    finally { setIsGeneratingPoster(false); }
  };

  const handleDownloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `Masterpiece_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 flex flex-col text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#fbfbfd] dark:bg-[#000000] overflow-hidden selection:bg-ios-blue selection:text-white">
      {/* HEADER */}
      <header className="h-14 glass-effect px-8 flex items-center justify-between z-[200] border-b border-black/[0.03] dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ios-blue rounded-xl flex items-center justify-center shadow-lg shadow-ios-blue/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[16px] font-extrabold tracking-tight leading-none mb-0.5">MrJ Studio Pro</h1>
            <span className="text-[8px] font-black text-ios-gray/60 uppercase tracking-[0.3em]">Elite Ad Synthesis</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cooldownTime > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-ios-blue/10 rounded-full text-ios-blue text-[10px] font-bold animate-pulse">
               <Clock className="w-3 h-3" /> {cooldownTime}S
            </div>
          )}
          <div className="flex items-center bg-black/5 dark:bg-white/10 p-1 rounded-full">
            <button 
              onClick={toggleFullscreen} 
              aria-label="Toggle Fullscreen"
              className="w-8 h-8 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-[#1d1d1f] dark:text-white transition-all"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              aria-label="Toggle Dark Mode"
              className="w-8 h-8 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-[#1d1d1f] dark:text-white transition-all"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setShowHistory(true)} 
              aria-label="View Design History"
              className="w-8 h-8 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-[#1d1d1f] dark:text-white transition-all"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        {/* LEFT STUDIO SIDEBAR */}
        <aside className={`${activeTab === 'studio' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[420px] h-full flex-col p-6 lg:p-10 gap-10 overflow-y-auto custom-scrollbar pb-32 border-r border-black/[0.03] dark:border-white/[0.05]`}>
          
          {/* 01 STUDIO ASSETS */}
          <section className="animate-ios-in">
            <div className="flex items-center justify-between mb-5 px-1">
              <h2 className="text-[12px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">01 Studio Assets</h2>
              <button 
                onClick={() => setBgRemovalEnabled(!bgRemovalEnabled)} 
                aria-label="Toggle Background Removal"
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2.5 ${bgRemovalEnabled ? 'bg-[#34C759] text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-[#8e8e93]'}`}
              >
                <CheckCircle2 className="w-4 h-4" /> BG Remove
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-4">
                <label className="relative h-44 rounded-[32px] bg-white dark:bg-[#1c1c1e] border border-black/[0.05] dark:border-white/[0.05] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-all shadow-sm overflow-hidden text-center group">
                  <input type="file" multiple onChange={(e) => e.target.files && processFiles(e.target.files, AssetType.PRODUCT)} className="hidden" aria-label="Upload Product Assets" />
                  <div className="w-14 h-14 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue group-hover:scale-110 transition-transform">
                    <PlusCircle className="w-7 h-7" />
                  </div>
                  <span className="text-[11px] font-black text-[#8e8e93] uppercase tracking-widest">Main Subject</span>
                </label>
                {subjectAssets.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 px-1">
                    {subjectAssets.map(a => (
                      <div key={a.id} className="relative aspect-square rounded-2xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] shadow-sm group">
                        <img src={a.isolatedUrl || a.url} className="w-full h-full object-contain p-1.5" alt={a.name} />
                        <button 
                          onClick={() => setSubjectAssets(prev => prev.filter(x => x.id !== a.id))} 
                          aria-label={`Remove ${a.name}`}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {a.status === 'processing' && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[2px]">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="relative h-44 rounded-[32px] bg-white dark:bg-[#1c1c1e] border border-black/[0.05] dark:border-white/[0.05] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-all shadow-sm overflow-hidden text-center group">
                  <input type="file" multiple onChange={(e) => e.target.files && processFiles(e.target.files, AssetType.CONTEXT)} className="hidden" aria-label="Upload Context Assets" />
                  <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <span className="text-[11px] font-black text-[#8e8e93] uppercase tracking-widest">Context/Env</span>
                </label>
                {contextAssets.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 px-1">
                    {contextAssets.map(a => (
                      <div key={a.id} className="relative aspect-square rounded-2xl overflow-hidden bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] shadow-sm group">
                        <img src={a.isolatedUrl || a.url} className="w-full h-full object-contain p-1.5" alt={a.name} />
                        <button 
                          onClick={() => setContextAssets(prev => prev.filter(x => x.id !== a.id))} 
                          aria-label={`Remove ${a.name}`}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {a.status === 'processing' && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[2px]">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 02 VISION ENGINE */}
          <section className="animate-ios-in space-y-5" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[12px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">02 Vision Engine</h2>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsArtDirectorMode(!isArtDirectorMode)} 
                  aria-label="Toggle Art Director Mode (Auto-Refine)"
                  className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${isArtDirectorMode ? 'bg-ios-blue text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-[#8e8e93]'}`}
                >
                  <Wand2 className="w-3 h-3" /> AD Mode
                </button>
                <button 
                  onClick={handleSmartScan} 
                  disabled={allAssets.length === 0 || isGenerating} 
                  aria-label="Run Smart DNA Scan"
                  className="text-[10px] font-black text-ios-blue disabled:opacity-30 flex items-center gap-2 hover:brightness-110 group uppercase tracking-widest transition-all"
                >
                  <BrainCircuit className="w-4 h-4" /> Smart Scan
                </button>
              </div>
            </div>

            <div className="relative group/textarea">
              <textarea 
                value={selectedPrompt} 
                onChange={(e) => setSelectedPrompt(e.target.value)} 
                disabled={isGenerating}
                placeholder="Synthesize your visual directive..." 
                aria-label="Visual Directive Editor"
                className="w-full bg-white dark:bg-[#1c1c1e] border border-black/[0.05] dark:border-white/[0.05] rounded-[32px] p-7 text-[15px] min-h-[160px] focus:ring-8 focus:ring-ios-blue/5 resize-none shadow-sm placeholder:text-ios-gray/40 leading-relaxed font-medium transition-all" 
              />
              <div className="absolute bottom-5 right-5 flex items-center gap-2">
                <div className="px-2 py-1 rounded-md border border-dashed border-ios-blue/30 text-[9px] text-ios-blue/40 font-bold uppercase tracking-widest opacity-0 group-hover/textarea:opacity-100 transition-opacity">Manual Refinement</div>
                <button 
                  onClick={handleRefinePrompt} 
                  disabled={!selectedPrompt || isGenerating} 
                  aria-label="Manually Refine Directive"
                  className="w-11 h-11 bg-black/5 dark:bg-white/10 text-ios-gray rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-30 border border-black/5 dark:border-white/5" 
                >
                  {isRefining ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </section>

          {/* 03 BRAND VOICE */}
          <section className="animate-ios-in space-y-5" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[12px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">03 Brand Voice</h2>
              <div className="flex items-center gap-5">
                <button 
                  onClick={clearCopyOnly} 
                  aria-label="Clear All Copy Fields"
                  className="text-[10px] font-black text-red-500 hover:opacity-70 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Clear
                </button>
                <button 
                  onClick={handleSmartCopy} 
                  disabled={allAssets.length === 0 || isGenerating} 
                  aria-label="Generate Smart Marketing Copy"
                  className="text-[10px] font-black text-ios-blue disabled:opacity-30 flex items-center gap-2 hover:brightness-110 group uppercase tracking-widest transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Smart Copy
                </button>
              </div>
            </div>

            <div className="space-y-4 group/copy-group">
              <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[28px] border border-black/[0.05] dark:border-white/[0.05] shadow-sm transition-all focus-within:ring-2 ring-ios-blue/10 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-black text-ios-gray/50 uppercase tracking-[0.15em] flex items-center gap-2">
                     <Zap className="w-3.5 h-3.5 text-ios-blue fill-current" /> Viral Headline Hook (on poster)
                  </span>
                  <button 
                    onClick={() => setMarketingCopy({...marketingCopy, headline: ''})} 
                    aria-label="Clear Headline Field"
                    className="opacity-0 group-hover/copy-group:opacity-100 transition-all text-[10px] font-black text-red-500/60 uppercase tracking-widest flex items-center gap-1.5 hover:text-red-500"
                  >
                    <Eraser className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <input value={marketingCopy.headline} onChange={(e) => setMarketingCopy({...marketingCopy, headline: e.target.value})} placeholder="The Elite Hook..." aria-label="Headline Input" className="w-full bg-transparent font-extrabold text-[16px] focus:outline-none placeholder:opacity-30" />
              </div>
              
              <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[28px] border border-black/[0.05] dark:border-white/[0.05] shadow-sm transition-all focus-within:ring-2 ring-ios-blue/10 relative">
                <span className="text-[10px] font-black text-ios-gray/50 uppercase block mb-2.5 tracking-[0.15em] flex items-center gap-2">
                   <Megaphone className="w-3.5 h-3.5 text-purple-500 fill-current" /> Social Body Copy (not in poster)
                </span>
                <textarea value={marketingCopy.body} onChange={(e) => setMarketingCopy({...marketingCopy, body: e.target.value})} placeholder="Elite social media caption..." aria-label="Social Caption Input" className="w-full bg-transparent text-[15px] focus:outline-none h-20 resize-none placeholder:opacity-30 leading-relaxed font-medium" />
              </div>

              <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[28px] border border-black/[0.05] dark:border-white/[0.05] shadow-sm transition-all focus-within:ring-2 ring-ios-blue/10 relative">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-black text-ios-gray/50 uppercase block tracking-[0.15em] flex items-center gap-2">
                     <RefreshCw className="w-3.5 h-3.5 text-ios-blue" /> Call to Action (on poster)
                  </span>
                  <button 
                    onClick={() => setMarketingCopy({...marketingCopy, cta: ''})} 
                    aria-label="Clear CTA Field"
                    className="opacity-0 group-hover/copy-group:opacity-100 transition-all text-[10px] font-black text-red-500/60 uppercase tracking-widest flex items-center gap-1.5 hover:text-red-500"
                  >
                    <Eraser className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <input value={marketingCopy.cta} onChange={(e) => setMarketingCopy({...marketingCopy, cta: e.target.value})} placeholder="e.g., Secure Yours Now..." aria-label="CTA Input" className="w-full bg-transparent font-extrabold text-ios-blue text-[16px] focus:outline-none placeholder:opacity-30" />
              </div>
            </div>
          </section>

          {/* 04 RESOLUTION MATRIX */}
          <section className="animate-ios-in px-1" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[12px] font-black text-[#8e8e93] uppercase tracking-[0.2em]">04 Resolution Matrix</h2>
              <button 
                onClick={handleToggleHighRes} 
                aria-label="Toggle 4K High Resolution Output"
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2.5 ${isHighRes ? 'bg-orange-500 text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-[#8e8e93]'}`}
              >
                <Cpu className="w-4 h-4" /> {isHighRes ? '4K Ultra' : '1K Standard'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {RATIO_OPTIONS.map((opt) => (
                <button 
                  key={opt.label} 
                  onClick={() => setAspectRatio(opt.label)}
                  aria-label={`Select aspect ratio: ${opt.label}`}
                  className={`p-5 rounded-[24px] border flex flex-col items-center gap-2 transition-all ${aspectRatio === opt.label ? 'border-ios-blue bg-ios-blue/5 text-ios-blue ring-4 ring-ios-blue/5 shadow-md scale-[1.03]' : 'border-black/[0.03] dark:border-white/[0.05] bg-white dark:bg-[#1c1c1e] hover:bg-black/[0.01]'}`}
                >
                  <opt.icon className="w-5 h-5" />
                  <span className="text-[12px] font-extrabold text-center leading-tight">{opt.label.split(' (')[0]}</span>
                  <span className="text-[10px] opacity-40 uppercase font-black tracking-widest">{opt.sub}</span>
                </button>
              ))}
            </div>

            {aspectRatio === 'Custom Size' && (
              <div className="flex gap-5 p-6 bg-white dark:bg-[#1c1c1e] rounded-[32px] border border-black/[0.05] dark:border-white/[0.05] animate-ios-in shadow-inner mb-8">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-ios-gray/50 uppercase block mb-2 tracking-widest">Width</label>
                  <input type="number" aria-label="Custom width in pixels" value={customWidth} onChange={(e) => setCustomWidth(parseInt(e.target.value))} className="w-full bg-transparent font-extrabold text-[16px] focus:outline-none border-b border-black/[0.05] focus:border-ios-blue pb-1.5" />
                </div>
                <div className="flex items-center text-ios-gray/40 font-black mt-5">×</div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-ios-gray/50 uppercase block mb-2 tracking-widest">Height</label>
                  <input type="number" aria-label="Custom height in pixels" value={customHeight} onChange={(e) => setCustomHeight(parseInt(e.target.value))} className="w-full bg-transparent font-extrabold text-[16px] focus:outline-none border-b border-black/[0.05] focus:border-ios-blue pb-1.5" />
                </div>
              </div>
            )}
          </section>

          <div className="mt-6 pb-24 px-1">
            <button 
              onClick={handleGeneratePoster} 
              disabled={isGenerating || allAssets.length === 0 || !selectedPrompt} 
              aria-label="Trigger Final Masterpiece Generation"
              className="w-full h-16 bg-gradient-to-r from-ios-blue to-[#005aff] text-white rounded-[32px] text-[17px] font-extrabold flex items-center justify-center gap-4 active:scale-95 shadow-2xl shadow-ios-blue/40 hover:brightness-110 transition-all disabled:opacity-20 relative overflow-hidden"
            >
              {isGeneratingPoster ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-white" />}
              {isHighRes ? 'Generate 4K Ultra' : 'Generate 1K Standard'}
            </button>
          </div>
        </aside>

        {/* MAIN PREVIEW STAGE */}
        <main className="flex-1 h-full flex flex-col items-center justify-center p-10 lg:p-20 overflow-hidden relative bg-[#f2f2f7] dark:bg-[#0a0a0a]">
          <div className={`relative rounded-[64px] overflow-hidden bg-white dark:bg-black/20 flex items-center justify-center w-full max-w-7xl h-full shadow-[0_48px_120px_-24px_rgba(0,0,0,0.15)] transition-all duration-1000 ${isGeneratingPoster ? 'opacity-0 scale-90 blur-3xl' : 'opacity-100 scale-100'} p-16 border border-white/40 dark:border-white/5`}>
            {finalImage ? (
              <div className="w-full h-full group relative rounded-[40px] overflow-hidden shadow-2xl">
                <img src={finalImage} className="w-full h-full object-contain" alt="Final Generated Ad Creative" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-12 backdrop-blur-3xl">
                  <button 
                    onClick={() => handleDownloadImage(finalImage)} 
                    aria-label="Download High-Res Masterpiece"
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-ios-blue shadow-2xl transform active:scale-90 hover:scale-110 transition-all"
                  >
                    <Download className="w-10 h-10" />
                  </button>
                  <button 
                    onClick={() => { setActiveTab('studio'); setFinalImage(null); }} 
                    aria-label="Return to Studio Editor"
                    className="w-20 h-20 bg-ios-blue rounded-full flex items-center justify-center text-white shadow-2xl transform active:scale-90 hover:scale-110 transition-all"
                  >
                    <Edit3 className="w-10 h-10" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center opacity-[0.05] dark:opacity-[0.1] flex flex-col items-center gap-10 pointer-events-none select-none">
                <Monitor className="w-64 h-64 text-ios-blue" />
                <div className="space-y-4">
                   <p className="text-[54px] font-black uppercase tracking-[0.5em] leading-none">Neural Output Stage</p>
                   <p className="text-[18px] font-bold uppercase tracking-[0.3em] text-ios-gray">
                     {aspectRatio === 'Custom Size' ? `${customWidth}X${customHeight}` : aspectRatio.toUpperCase()}
                   </p>
                </div>
              </div>
            )}
          </div>

          {isGeneratingPoster && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-14 z-[1000] bg-[#f2f2f7]/85 dark:bg-[#0a0a0a]/85 backdrop-blur-3xl animate-ios-in text-center">
              <div className="relative">
                <div className="w-56 h-56 border-[16px] border-ios-blue/10 border-t-ios-blue rounded-full animate-spin shadow-2xl"></div>
                <Sparkles className="absolute inset-0 m-auto w-20 h-20 text-ios-blue animate-pulse" />
              </div>
              <div className="space-y-5">
                <p className="text-[38px] font-black tracking-tighter uppercase text-[#1d1d1f] dark:text-white">Synthesizing Creative</p>
                <p className="text-[18px] font-extrabold text-ios-gray uppercase tracking-[0.5em]">{LOADING_MESSAGES[loadingStep]}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE TAB NAV */}
      <nav className="h-24 glass-effect flex items-center justify-around fixed bottom-0 w-full z-[400] lg:hidden border-t border-black/[0.05] pb-6">
        <button 
          onClick={() => setActiveTab('studio')} 
          aria-label="Switch to Studio View"
          className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'studio' ? 'text-ios-blue scale-110' : 'text-ios-gray opacity-40'}`}
        >
          <Layers className="w-7 h-7" />
          <span className="text-[11px] font-black uppercase tracking-widest">Studio</span>
        </button>
        <button 
          onClick={() => setActiveTab('preview')} 
          aria-label="Switch to Preview View"
          className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'preview' ? 'text-ios-blue scale-110' : 'text-ios-gray opacity-40'}`}
        >
          <Monitor className="w-7 h-7" />
          <span className="text-[11px] font-black uppercase tracking-widest">Preview</span>
        </button>
      </nav>

      {/* ERROR MODAL */}
      {error && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-8 bg-black/70 backdrop-blur-3xl">
          <div className="w-full max-w-[400px] bg-white dark:bg-[#1c1c1e] rounded-[48px] p-14 text-center shadow-[0_64px_120px_rgba(0,0,0,0.5)] animate-ios-in border border-black/[0.05]">
            <div className={`w-24 h-24 ${error.type === 'quota' ? 'bg-ios-blue/10' : 'bg-red-500/10'} rounded-full flex items-center justify-center mb-10 mx-auto`}>
              {error.type === 'quota' ? <ShieldAlert className="w-12 h-12 text-ios-blue" /> : <AlertCircle className="w-12 h-12 text-red-500" />}
            </div>
            <h3 className="text-[28px] font-black mb-5 tracking-tight">{error.type === 'quota' ? 'System Capacity' : 'Studio Alert'}</h3>
            <p className="text-[17px] text-ios-gray leading-relaxed mb-12">{error.message}</p>
            <button 
              onClick={() => setError(null)} 
              aria-label="Close Error Modal Overlay"
              className="w-full h-16 bg-ios-blue text-white rounded-[32px] font-extrabold transform active:scale-95 shadow-xl shadow-ios-blue/30 transition-all hover:brightness-110"
            >
              Acknowledged
            </button>
          </div>
        </div>
      )}

      {/* KEY SELECTION OVERLAY */}
      {showKeySelectionOverlay && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-3xl animate-ios-in">
          <div className="w-full max-w-[440px] bg-white dark:bg-[#1c1c1e] rounded-[56px] p-16 text-center shadow-2xl border border-white/10">
            <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mb-10 mx-auto">
              <Key className="w-12 h-12 text-orange-500" />
            </div>
            <h3 className="text-[32px] font-black mb-6 tracking-tight">4K Ultra Engine</h3>
            <p className="text-[16px] text-ios-gray leading-relaxed mb-8">
              High-Res rendering requires an active API key from a paid GCP project. 
              Please select your key to unlock the 4K Ultra synthesis engine.
            </p>
            <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl mb-12 text-[12px] text-ios-gray font-medium">
              See <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-ios-blue underline">Billing Docs</a> for details.
            </div>
            <div className="flex flex-col gap-4">
              <button 
                onClick={handleOpenKeySelection} 
                className="w-full h-16 bg-orange-500 text-white rounded-[32px] font-extrabold shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
              >
                Select API Key
              </button>
              <button 
                onClick={() => { setIsHighRes(false); setShowKeySelectionOverlay(false); }} 
                className="w-full h-16 bg-black/5 dark:bg-white/10 text-ios-gray rounded-[32px] font-bold active:scale-95 transition-all"
              >
                Back to 1K Standard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE DRAWER */}
      {showHistory && (
        <div className="fixed inset-0 z-[500] flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl transition-all" onClick={() => setShowHistory(false)} aria-label="Close History Overlay" />
          <aside className="relative ml-auto w-full max-w-2xl h-full bg-[#f5f5f7] dark:bg-[#080808] shadow-[0_0_150px_rgba(0,0,0,0.7)] flex flex-col p-14 animate-ios-in border-l border-white/5">
            <div className="flex items-center justify-between mb-14">
              <h2 className="text-[36px] font-black tracking-tighter uppercase titanium-text">Creative Archive</h2>
              <button 
                onClick={() => setShowHistory(false)} 
                aria-label="Close History Archive Drawer"
                className="w-14 h-14 flex items-center justify-center bg-black/5 dark:bg-white/10 rounded-full transform active:scale-90 transition-all hover:bg-red-500/10 hover:text-red-500"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-12 custom-scrollbar pr-6">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-8">
                   <History className="w-20 h-20" />
                   <p className="text-xl font-bold uppercase tracking-widest text-center leading-loose">No Masters Recorded Yet</p>
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} className="rounded-[48px] overflow-hidden bg-white dark:bg-[#1c1c1e] border border-black/5 group relative shadow-2xl transform hover:-translate-y-3 transition-all duration-1000">
                    <img 
                      src={item.imageUrl} 
                      className="w-full aspect-video object-cover cursor-pointer hover:scale-105 transition-all duration-1000" 
                      alt="Archived Creative Poster"
                      onClick={() => { setFinalImage(item.imageUrl); setShowHistory(false); setActiveTab('preview'); }} 
                    />
                    <div className="p-10">
                      <p className="text-[16px] font-extrabold line-clamp-2 mb-6 leading-relaxed">{item.prompt}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-ios-gray font-black uppercase flex items-center gap-2 tracking-[0.05em]"><Clock className="w-5 h-5" /> {new Date(item.timestamp).toLocaleDateString()}</p>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleDownloadImage(item.imageUrl)} 
                            aria-label="Download archived creative"
                            className="w-12 h-12 bg-ios-blue/10 text-ios-blue rounded-full flex items-center justify-center hover:bg-ios-blue hover:text-white transition-all"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => { setFinalImage(item.imageUrl); setShowHistory(false); setActiveTab('preview'); }} 
                            aria-label="Restore archived creative to stage"
                            className="w-12 h-12 bg-black/5 dark:bg-white/10 text-ios-gray rounded-full flex items-center justify-center hover:bg-ios-blue hover:text-white transition-all"
                          >
                            <Undo2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default App;
