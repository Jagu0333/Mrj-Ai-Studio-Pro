
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  RefreshCw, 
  Zap, 
  Monitor,
  Download,
  History,
  ToggleLeft,
  ToggleRight,
  Clock,
  X,
  PlusCircle,
  Palette,
  BrainCircuit,
  Type as TypeIcon,
  AlertCircle,
  ChevronRight,
  PenTool,
  Trophy,
  Layers,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Lock,
  Camera,
  FileDown,
  Maximize,
  Minimize,
  Trash2,
  Send,
  Youtube,
  Instagram,
  Facebook,
  Smartphone,
  Layout,
  Command,
  ChevronLeft,
  Moon,
  Sun,
  Info,
  Cpu,
  Globe
} from 'lucide-react';
import { 
  Asset, 
  AssetType, 
  AnalysisResult, 
  MarketingCopy, 
  AspectRatio,
  HistoryItem
} from './types';
import * as gemini from './services/geminiService';
import * as db from './services/dbService';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Instagram Post (1:1)');
  const [marketingCopy, setMarketingCopy] = useState<MarketingCopy>({ headline: '', caption: '', cta: '' });
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isIsolating, setIsIsolating] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'preview'>('studio');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('studio-theme');
    return saved === 'dark';
  });

  useEffect(() => {
    loadHistory();
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
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
    if (bgRemovalEnabled) {
      assets.forEach(asset => {
        if (!asset.isolatedBase64 && !isIsolating.includes(asset.id)) {
          triggerIsolation(asset);
        }
      });
    }
  }, [bgRemovalEnabled, assets.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const loadHistory = async () => {
    try {
      const items = await db.getHistory();
      setHistory(items);
    } catch (err) {
      console.error("History load error", err);
    }
  };

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const triggerIsolation = (asset: Asset) => {
    setIsIsolating(prev => [...prev, asset.id]);
    gemini.isolateSubject(asset).then(res => {
      setAssets(prev => prev.map(a => 
        a.id === asset.id ? { ...a, isolatedBase64: res.base64, isolatedUrl: res.url } : a
      ));
    }).catch(err => {
      console.error("BG Removal Fail", err);
    }).finally(() => {
      setIsIsolating(prev => prev.filter(id => id !== asset.id));
    });
  };

  const processFiles = async (files: FileList | File[], type: AssetType) => {
    setError(null);
    const newAssets: Asset[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const promise = new Promise<Asset>((resolve, reject) => {
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
              mimeType: normalized.mimeType 
            });
          } catch (e) { reject(e); }
        };
        reader.onerror = () => reject("File read error");
      });
      reader.readAsDataURL(file);
      try {
        newAssets.push(await promise);
      } catch (e) {
        setError("Error processing image file.");
      }
    }
    setAssets(prev => [...prev, ...newAssets]);
  };

  const handleAnalyzeAssets = async () => {
    if (assets.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await gemini.analyzeAssets(assets);
      setAnalysis(res);
      setSelectedPrompt(res.suggestedPrompt);
    } catch (err: any) {
      setError(err.message || "Asset Analysis error.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefinePrompt = async () => {
    if (!selectedPrompt) return;
    setIsRefining(true);
    setError(null);
    try {
      const refined = await gemini.refinePrompt(selectedPrompt, analysis);
      setSelectedPrompt(refined);
    } catch (err: any) {
      setError(err.message || "Refinement declined.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!selectedPrompt) {
      setError("Please provide a vision first.");
      return;
    };
    setIsGeneratingCopy(true);
    setError(null);
    try {
      const copy = await gemini.generateMarketingCopy(selectedPrompt, analysis);
      setMarketingCopy(copy);
    } catch (err: any) {
      setError(err.message || "Copywriting service unavailable.");
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const clearCopy = () => {
    setMarketingCopy({ headline: '', caption: '', cta: '' });
  };

  const handleGeneratePoster = async () => {
    if (assets.length === 0 || !selectedPrompt) {
      setError("Add assets and a vision to start.");
      return;
    }
    setError(null);
    setIsGeneratingPoster(true);
    setActiveTab('preview');
    
    try {
      const img = await gemini.generatePoster(
        assets, 
        selectedPrompt, 
        aspectRatio, 
        bgRemovalEnabled, 
        marketingCopy.headline ? marketingCopy : null
      );
      
      setFinalImage(img);
      const item: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        imageUrl: img,
        prompt: selectedPrompt,
        copy: marketingCopy.headline ? marketingCopy : null,
        ratio: aspectRatio,
        timestamp: Date.now()
      };
      await db.saveHistoryItem(item);
      loadHistory();
    } catch (err: any) {
      setError(err.message || "Creative Vision blocked.");
      setActiveTab('studio');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  const downloadFile = (url: string, baseLabel: string) => {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const uniqueName = `${baseLabel}_${timestamp}.png`;
    const link = document.createElement('a');
    link.href = url;
    link.download = uniqueName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reuseHistory = (item: HistoryItem) => {
    setSelectedPrompt(item.prompt);
    setMarketingCopy(item.copy || { headline: '', caption: '', cta: '' });
    setAspectRatio(item.ratio);
    setFinalImage(item.imageUrl);
    setShowHistory(false);
    setActiveTab('studio');
  };

  const ratioOptions: { label: AspectRatio; desc: string; pixels: string; icon: React.ReactNode }[] = [
    { label: 'Instagram Post (1:1)', desc: '1:1 Square', pixels: '1080 × 1080 px', icon: <Instagram className="w-5 h-5" /> },
    { label: 'Instagram Portrait (4:5)', desc: '4:5 Portrait', pixels: '1080 × 1350 px', icon: <Smartphone className="w-5 h-5" /> },
    { label: 'Instagram Reel (9:16)', desc: '9:16 Vertical', pixels: '1080 × 1920 px', icon: <Smartphone className="w-5 h-5" /> },
    { label: 'Facebook Post (16:9)', desc: '16:9 Landscape', pixels: '1200 × 630 px', icon: <Facebook className="w-5 h-5" /> },
    { label: 'YouTube Thumbnail (16:9)', desc: '16:9 HD', pixels: '1280 × 720 px', icon: <Youtube className="w-5 h-5" /> }
  ];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden text-[#1d1d1f] dark:text-[#ffffff] bg-[#f5f5f7] dark:bg-[#000000]">
      
      {/* iOS Header */}
      <header className="h-14 lg:h-16 glass-effect px-4 lg:px-8 flex items-center justify-between z-[100] border-b border-black/5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 bg-[#007aff] dark:bg-[#0a84ff] rounded-[10px] flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <h1 className="text-[17px] font-bold tracking-tight">MrJ AI Studio</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAbout(true)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 text-[#007aff] dark:text-[#0a84ff]"
            title="Project Info"
          >
            <Info className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 text-[#007aff] dark:text-[#0a84ff]"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={toggleFullscreen}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 text-[#007aff] dark:text-[#0a84ff]"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={() => setShowHistory(true)} 
            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 text-[#007aff] dark:text-[#0a84ff]"
            title="View Archive"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* iOS Alert Modal */}
      {error && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-[270px] bg-white/95 dark:bg-[#2c2c2e]/95 rounded-[14px] overflow-hidden flex flex-col items-center text-center shadow-xl animate-ios-in">
            <div className="p-4 pt-5">
              <h3 className="text-[17px] font-semibold mb-1">Production Alert</h3>
              <p className="text-[13px] leading-snug opacity-80">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="w-full h-11 border-t border-black/10 dark:border-white/10 text-[17px] font-semibold text-[#007aff] dark:text-[#0a84ff] hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* About / Credits Modal */}
      {showAbout && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-ios-in">
          <div className="w-full max-w-[500px] bg-[#f5f5f7] dark:bg-[#1c1c1e] rounded-[32px] overflow-hidden flex flex-col shadow-2xl border border-white/10">
            <div className="relative p-8 lg:p-10 flex flex-col">
              <button onClick={() => setShowAbout(false)} className="absolute top-6 right-6 p-2 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 transition-all">
                <X className="w-5 h-5 text-[#8e8e93]" />
              </button>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#007aff] rounded-2xl flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-[24px] font-extrabold tracking-tight">MrJ AI Studio Pro</h2>
                  <p className="text-[#8e8e93] text-[14px] font-medium">Multimodal Marketing Engine</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-[#007aff]/10 rounded-xl">
                    <Cpu className="w-6 h-6 text-[#007aff]" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold mb-1">Advanced AI Core</h3>
                    <p className="text-[13px] text-[#8e8e93] leading-relaxed">
                      Powered by <span className="text-[#1d1d1f] dark:text-white font-bold">Gemini 3 Flash Preview</span> for deep asset analysis, prompt engineering, and professional copywriting.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-[#5856d6]/10 rounded-xl">
                    <Layers className="w-6 h-6 text-[#5856d6]" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold mb-1">Visual Synthesis</h3>
                    <p className="text-[13px] text-[#8e8e93] leading-relaxed">
                      Utilizes <span className="text-[#1d1d1f] dark:text-white font-bold">Gemini 2.5 Flash Image</span> for high-fidelity subject isolation (Auto-Mask) and seamless 8K ad compositing.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-[#34c759]/10 rounded-xl">
                    <Globe className="w-6 h-6 text-[#34c759]" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold mb-1">Hackathon Entry</h3>
                    <p className="text-[13px] text-[#8e8e93] leading-relaxed">
                      Developed for the <span className="text-[#007aff] font-bold underline">Google Gemini API Developer Competition</span> to showcase the power of multimodal LLMs in professional creative workflows.
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowAbout(false)}
                className="mt-10 w-full h-14 bg-[#007aff] text-white rounded-2xl text-[16px] font-bold shadow-lg active:scale-95 transition-all"
              >
                Close Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Production View */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Left Control Column */}
        <aside className={`${activeTab === 'studio' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[400px] h-full flex-col bg-[#f5f5f7] dark:bg-[#000000] border-r border-black/5 dark:border-white/10 p-4 lg:p-6 gap-6 overflow-y-auto custom-scrollbar pb-32`}>
          
          {/* Step 01: Media */}
          <section className="animate-ios-in" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wider">01 Creative Media</h2>
              <button 
                onClick={() => setBgRemovalEnabled(!bgRemovalEnabled)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all ${bgRemovalEnabled ? 'bg-[#34c759] text-white shadow-sm' : 'bg-[#e5e5ea] dark:bg-[#2c2c2e] text-[#8e8e93]'}`}
              >
                Auto-Mask
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="h-24 rounded-[16px] flex flex-col items-center justify-center gap-2 cursor-pointer bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 hover:bg-[#fbfbfd] dark:hover:bg-[#2c2c2e] transition-all group shadow-sm">
                <input type="file" multiple onChange={(e) => e.target.files && processFiles(e.target.files, AssetType.PRODUCT)} className="hidden" />
                <PlusCircle className="w-6 h-6 text-[#007aff] dark:text-[#0a84ff]" />
                <span className="text-[11px] font-medium text-[#8e8e93]">Main Subject</span>
              </label>
              <label className="h-24 rounded-[16px] flex flex-col items-center justify-center gap-2 cursor-pointer bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 hover:bg-[#fbfbfd] dark:hover:bg-[#2c2c2e] transition-all group shadow-sm">
                <input type="file" multiple onChange={(e) => e.target.files && processFiles(e.target.files, AssetType.MODEL)} className="hidden" />
                <ImageIcon className="w-6 h-6 text-[#5856d6] dark:text-[#bf5af2]" />
                <span className="text-[11px] font-medium text-[#8e8e93]">Support Assets</span>
              </label>
            </div>

            {assets.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scroll-smooth no-scrollbar">
                {assets.map(asset => (
                  <div key={asset.id} className="relative shrink-0 w-16 h-16 rounded-[12px] bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 overflow-hidden group shadow-sm">
                    <img src={(bgRemovalEnabled && asset.isolatedUrl) ? asset.isolatedUrl : asset.url} className="w-full h-full object-cover" alt="Asset" />
                    <button onClick={() => removeAsset(asset.id)} className="absolute top-0 right-0 p-1 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all rounded-bl-lg">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {isIsolating.includes(asset.id) && (
                      <div className="absolute inset-0 bg-white/60 dark:bg-black/60 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#007aff] dark:text-[#0a84ff]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Step 02: Vision */}
          <section className="animate-ios-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wider">02 Campaign Vision</h2>
              <button onClick={handleAnalyzeAssets} disabled={assets.length === 0 || isAnalyzing} className="text-[12px] font-semibold text-[#007aff] dark:text-[#0a84ff] disabled:opacity-30">
                {isAnalyzing ? 'Scanning...' : 'Smart Scan'}
              </button>
            </div>
            <div className="relative">
              <textarea 
                value={selectedPrompt} 
                onChange={(e) => setSelectedPrompt(e.target.value)} 
                placeholder="Describe your scene..." 
                className="w-full bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[16px] p-4 text-[14px] leading-normal min-h-[140px] resize-none focus:ring-2 focus:ring-[#007aff]/10 transition-all" 
              />
              <button 
                onClick={handleRefinePrompt} 
                disabled={!selectedPrompt || isRefining} 
                className="absolute bottom-3 right-3 p-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#3a3a3c] rounded-full transition-all disabled:opacity-30 active:scale-95"
              >
                {isRefining ? <RefreshCw className="w-4 h-4 animate-spin text-[#007aff] dark:text-[#0a84ff]" /> : <BrainCircuit className="w-4 h-4 text-[#007aff] dark:text-[#0a84ff]" />}
              </button>
            </div>
          </section>

          {/* Step 03: Text Content */}
          <section className="animate-ios-in" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wider">03 Advertising Copy</h2>
              <div className="flex gap-4">
                <button onClick={clearCopy} className="text-[12px] font-semibold text-[#ff3b30] dark:text-[#ff453a]"><Trash2 className="w-4 h-4" /></button>
                <button onClick={handleGenerateCopy} disabled={!selectedPrompt || isGeneratingCopy} className="text-[12px] font-semibold text-[#007aff] dark:text-[#0a84ff]">
                  {isGeneratingCopy ? 'Writing...' : 'AI Writer'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <input 
                type="text" 
                value={marketingCopy.headline} 
                onChange={(e) => setMarketingCopy({...marketingCopy, headline: e.target.value})} 
                className="w-full bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[12px] px-4 py-3 text-[14px] font-semibold" 
                placeholder="Main Headline"
              />
              <textarea 
                value={marketingCopy.caption} 
                onChange={(e) => setMarketingCopy({...marketingCopy, caption: e.target.value})} 
                className="w-full bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[12px] px-4 py-3 text-[13px] min-h-[80px] resize-none" 
                placeholder="Story/Caption"
              />
              <input 
                type="text" 
                value={marketingCopy.cta} 
                onChange={(e) => setMarketingCopy({...marketingCopy, cta: e.target.value})} 
                className="w-full bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-[12px] px-4 py-3 text-[14px] font-bold text-[#007aff] dark:text-[#0a84ff]" 
                placeholder="Call to Action"
              />
            </div>
          </section>

          {/* Step 04: Aspect */}
          <section className="animate-ios-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-3 px-1">04 Format</h2>
            <div className="grid grid-cols-1 gap-2">
              {ratioOptions.map(option => (
                <button 
                  key={option.label} 
                  onClick={() => setAspectRatio(option.label)} 
                  className={`flex items-center justify-between p-3 rounded-[14px] border transition-all active:scale-[0.98] ${aspectRatio === option.label ? 'bg-white dark:bg-[#2c2c2e] border-[#007aff] dark:border-[#0a84ff] shadow-sm' : 'bg-[#e5e5ea]/50 dark:bg-[#1c1c1e]/50 border-transparent text-[#8e8e93]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${aspectRatio === option.label ? 'text-[#007aff] dark:text-[#0a84ff]' : 'text-[#8e8e93]'} transition-all`}>
                      {option.icon}
                    </div>
                    <div className="text-left">
                      <span className={`block text-[13px] font-semibold ${aspectRatio === option.label ? 'text-[#1d1d1f] dark:text-white' : 'text-[#8e8e93]'}`}>{option.label}</span>
                      <span className="block text-[11px] opacity-70 mt-0.5">{option.pixels} ({option.desc})</span>
                    </div>
                  </div>
                  {aspectRatio === option.label && <CheckCircle2 className="w-4 h-4 text-[#007aff] dark:text-[#0a84ff]" />}
                </button>
              ))}
            </div>
          </section>

          <button 
            onClick={handleGeneratePoster} 
            disabled={isGeneratingPoster || assets.length === 0 || !selectedPrompt} 
            className="mt-4 w-full h-14 bg-[#007aff] dark:bg-[#0a84ff] hover:bg-[#0071e3] dark:hover:bg-[#0071e3] rounded-[18px] text-[16px] font-bold text-white shadow-lg shadow-[#007aff]/20 active:scale-[0.97] transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {isGeneratingPoster ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
            {isGeneratingPoster ? "Rendering..." : "Create Campaign"}
          </button>
        </aside>

        {/* Center Screen Preview */}
        <main className={`${activeTab === 'preview' ? 'flex' : 'hidden'} lg:flex flex-1 h-full flex-col items-center justify-center p-6 lg:p-12 overflow-hidden bg-white dark:bg-[#121212]`}>
          <div className={`w-full h-full flex flex-col items-center justify-center transition-all duration-700 ${isGeneratingPoster ? 'opacity-30 blur-xl scale-95' : 'opacity-100 scale-100'}`}>
            <div className={`relative rounded-[28px] lg:rounded-[40px] overflow-hidden bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 flex items-center justify-center w-full h-full shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] transition-all duration-500 ${
              aspectRatio.includes('(1:1)') ? 'aspect-square' :
              aspectRatio.includes('(4:5)') ? 'aspect-[4/5]' :
              aspectRatio.includes('(9:16)') ? 'aspect-[9/16]' : 'aspect-[16/9]'
            } max-w-full max-h-full`}>
              {finalImage ? (
                <div className="w-full h-full group relative">
                  <img src={finalImage} className="w-full h-full object-contain" alt="Final Ad" />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-sm">
                    <button 
                      onClick={() => downloadFile(finalImage!, `Ad_Campaign`)} 
                      className="w-20 h-20 bg-white/90 dark:bg-black/90 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all text-[#007aff] dark:text-[#0a84ff]"
                    >
                      <Download className="w-8 h-8" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 opacity-40">
                  <div className="w-24 h-24 bg-white dark:bg-[#2c2c2e] rounded-full flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm">
                    <Monitor className="w-10 h-10 text-[#007aff] dark:text-[#0a84ff]" />
                  </div>
                  <p className="text-[14px] font-bold text-[#8e8e93] uppercase tracking-widest">Ready for Production</p>
                </div>
              )}
            </div>
            
            {finalImage && (
              <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto animate-ios-in">
                <button onClick={() => downloadFile(finalImage!, `MRJ_Studio_Export`)} className="px-10 py-4 bg-[#007aff] dark:bg-[#0a84ff] text-white rounded-full text-[15px] font-bold flex items-center justify-center gap-2 active:scale-95 shadow-md">
                  Export to Device <Download className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveTab('studio')} className="px-10 py-4 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white rounded-full text-[15px] font-bold flex items-center justify-center gap-2 active:scale-95">
                  Back <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {isGeneratingPoster && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-[100] animate-ios-in">
              <div className="w-16 h-16 border-[4px] border-black/5 dark:border-white/10 border-t-[#007aff] dark:border-t-[#0a84ff] rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-[19px] font-bold mb-1">Synthesizing Vision</h3>
                <p className="text-[13px] text-[#8e8e93]">Advanced Neural Composition Active...</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* History Slide-over */}
      {showHistory && (
        <div className="fixed inset-0 z-[400] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowHistory(false)} />
          <aside className="relative ml-auto w-full sm:w-[380px] h-full bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-2xl flex flex-col p-6 animate-ios-in">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[20px] font-bold flex items-center gap-3">
                <Clock className="w-6 h-6 text-[#007aff] dark:text-[#0a84ff]" /> Archive
              </h2>
              <button onClick={() => setShowHistory(false)} className="p-2 bg-[#e5e5ea] dark:bg-[#2c2c2e] rounded-full active:scale-90 transition-all text-[#8e8e93]">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pb-10 scrollbar-hide">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                  <History className="w-16 h-16" />
                  <p className="text-[14px] font-bold">No saved campaigns</p>
                </div>
              ) : (
                history.map(item => (
                  <div 
                    key={item.id} 
                    className="rounded-[20px] overflow-hidden bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 group shadow-sm cursor-pointer active:scale-95 transition-all" 
                    onClick={() => reuseHistory(item)}
                  >
                    <div className="relative aspect-video">
                      <img src={item.imageUrl} className="w-full h-full object-cover" alt="History" />
                      <div className="absolute inset-0 bg-black/5 dark:bg-black/10 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <span className="text-[12px] font-bold text-[#007aff] dark:text-[#0a84ff] bg-white dark:bg-[#1c1c1e] px-4 py-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all">Restore</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="lg:hidden h-16 glass-effect flex items-center justify-around fixed bottom-0 w-full z-[150] pb-2 border-t border-black/5 dark:border-white/10">
        <button onClick={() => setActiveTab('studio')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'studio' ? 'text-[#007aff] dark:text-[#0a84ff]' : 'text-[#8e8e93]'}`}>
          <Layers className="w-6 h-6" />
          <span className="text-[10px] font-semibold">Studio</span>
        </button>
        <button onClick={() => setActiveTab('preview')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'preview' ? 'text-[#007aff] dark:text-[#0a84ff]' : 'text-[#8e8e93]'}`}>
          <Monitor className="w-6 h-6" />
          <span className="text-[10px] font-semibold">Preview</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
