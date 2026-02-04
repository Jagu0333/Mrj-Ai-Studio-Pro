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
  RotateCcw,
  Moon,
  Sun,
  Type as TypeIcon,
  Megaphone,
  Smartphone,
  Layers,
  CheckCircle2,
  Maximize,
  Minimize,
  Trash2,
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Instagram Square (1:1)');
  const [marketingCopy, setMarketingCopy] = useState<MarketingCopy>({ headline: '', caption: '', cta: '' });
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'preview'>('studio');
  const [error, setError] = useState<string | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('studio-theme') === 'dark');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    loadHistory();
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err.message));
    } else {
      document.exitFullscreen();
    }
  };

  const loadHistory = async () => {
    try {
      const items = await db.getHistory();
      setHistory(items);
    } catch (err) {
      console.error("History error", err);
    }
  };

  const triggerIsolation = useCallback(async (assetId: string) => {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'processing' } : a));
    try {
      const target = assets.find(a => a.id === assetId);
      if (!target) return;
      const res = await gemini.isolateSubject(target);
      setAssets(prev => prev.map(a => 
        a.id === assetId ? { ...a, isolatedBase64: res.base64, isolatedUrl: res.url, status: 'completed' } : a
      ));
    } catch (err: any) {
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'failed', error: err.message } : a));
    } finally {
      setIsCoolingDown(true);
      setTimeout(() => setIsCoolingDown(false), 2000); 
    }
  }, [assets]);

  useEffect(() => {
    if (!bgRemovalEnabled || isCoolingDown) return;
    if (assets.some(a => a.status === 'processing')) return;
    const nextPending = assets.find(a => (!a.status || a.status === 'pending') && !a.isolatedBase64);
    if (nextPending) triggerIsolation(nextPending.id);
  }, [assets, bgRemovalEnabled, isCoolingDown, triggerIsolation]);

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
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
              mimeType: normalized.mimeType,
              status: 'pending'
            });
          } catch (e) { reject(e); }
        };
        reader.onerror = () => reject("File read error");
      });
      reader.readAsDataURL(file);
      try { newAssets.push(await promise); } catch (e) { setError("Error processing file."); }
    }
    setAssets(prev => [...prev, ...newAssets]);
  };

  const handleAnalyzeAssets = async () => {
    if (assets.length === 0) return;
    setIsAnalyzing(true);
    try {
      const res = await gemini.analyzeAssets(assets);
      setAnalysis(res);
      setSelectedPrompt(res.suggestedPrompt);
    } catch (err: any) { setError(err.message); }
    finally { setIsAnalyzing(false); }
  };

  const handleRefinePrompt = async () => {
    if (!selectedPrompt) return;
    setIsRefining(true);
    try {
      const refined = await gemini.refinePrompt(selectedPrompt);
      setSelectedPrompt(refined);
    } catch (err: any) { setError(err.message); }
    finally { setIsRefining(false); }
  };

  const handleGenerateCopy = async () => {
    if (!selectedPrompt) return setError("Provide creative vision first.");
    setIsGeneratingCopy(true);
    try {
      const copy = await gemini.generateMarketingCopy(selectedPrompt);
      setMarketingCopy(copy);
    } catch (err: any) { setError(err.message); }
    finally { setIsGeneratingCopy(false); }
  };

  const handleClearCopy = () => {
    setMarketingCopy({ headline: '', caption: '', cta: '' });
  };

  const handleGeneratePoster = async () => {
    if (assets.length === 0 || !selectedPrompt) return setError("Missing assets or creative vision.");
    setIsGeneratingPoster(true);
    setActiveTab('preview');
    try {
      const img = await gemini.generatePoster(assets, selectedPrompt, aspectRatio, bgRemovalEnabled);
      setFinalImage(img);
      const item: HistoryItem = { id: Math.random().toString(36).substr(2, 9), imageUrl: img, prompt: selectedPrompt, copy: marketingCopy.headline ? marketingCopy : null, ratio: aspectRatio, timestamp: Date.now() };
      await db.saveHistoryItem(item);
      loadHistory();
    } catch (err: any) { setError(err.message); setActiveTab('studio'); }
    finally { setIsGeneratingPoster(false); }
  };

  const handleDownload = (imageUrl: string, prefix: string = 'Design') => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const uniqueId = Date.now();
    link.download = `MrJ_Studio_${prefix}_${uniqueId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ratioOptions: { label: AspectRatio; icon: React.ReactNode; pixels: string }[] = [
    { label: 'Instagram Square (1:1)', icon: <Layers className="w-5 h-5" />, pixels: '1080x1080' },
    { label: 'Instagram Portrait (4:5)', icon: <Smartphone className="w-5 h-5" />, pixels: '1080x1350' },
    { label: 'Instagram Story (9:16)', icon: <Smartphone className="w-5 h-5" />, pixels: '1080x1920' },
    { label: 'Facebook Feed (16:9)', icon: <Monitor className="w-5 h-5" />, pixels: '1200x630' },
    { label: 'Facebook Cover (16:9)', icon: <Monitor className="w-5 h-5" />, pixels: '820x312' },
    { label: 'YouTube Thumbnail (16:9)', icon: <Monitor className="w-5 h-5" />, pixels: '1280x720' },
    { label: 'LinkedIn Feed (4:5)', icon: <Layers className="w-5 h-5" />, pixels: '1080x1350' },
    { label: 'LinkedIn Header (16:9)', icon: <Monitor className="w-5 h-5" />, pixels: '1584x396' }
  ];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#000000] selection:bg-ios-blue selection:text-white">
      
      {/* Header - Fixed 64px Standard Height */}
      <header className="h-16 glass-nav px-8 lg:px-12 flex items-center justify-between z-[200]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-ios-blue rounded-ios flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[17px] font-extrabold tracking-tight leading-none titanium-text">MrJ Studio <span className="text-ios-blue font-black">Pro</span></h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[#8e8e93] mt-1 opacity-60">Elite Ad Synthesis</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-full">
          <button onClick={toggleFullscreen} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-full text-ios-blue active:scale-90 transition-all" title="Full Screen">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-full text-ios-blue active:scale-90 transition-all" title="Appearance">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setShowHistory(true)} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-full text-ios-blue active:scale-90 transition-all" title="Recent History">
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Sidebar - Pro Aligned 420px Standard */}
        <aside className={`${activeTab === 'studio' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[420px] h-full flex-col p-8 lg:p-10 gap-8 overflow-y-auto ios-scrollbar pb-32`}>
          
          {/* Section 01: Assets */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0s' }}>
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="sidebar-section-title !mb-0">01 Studio Assets</h2>
              <button 
                onClick={() => setBgRemovalEnabled(!bgRemovalEnabled)}
                className={`flex items-center gap-2 text-[10px] font-extrabold px-3 py-1.5 rounded-full transition-all ${bgRemovalEnabled ? 'bg-[#34c759] text-white shadow-lg' : 'bg-transparent border border-[#8e8e93]/30 text-[#8e8e93]'}`}
              >
                {bgRemovalEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                BG Remove
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="group h-24 rounded-ios glass-card flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/90 dark:hover:bg-white/10 active:scale-95">
                <input type="file" multiple onChange={(e) => e.target.files && processFiles(e.target.files, AssetType.PRODUCT)} className="hidden" />
                <div className="w-9 h-9 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue group-hover:bg-ios-blue group-hover:text-white transition-all">
                  <PlusCircle className="w-5.5 h-5.5" />
                </div>
                <span className="text-[11px] font-bold opacity-60">Main Product</span>
              </label>
              <label className="group h-24 rounded-ios glass-card flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/90 dark:hover:bg-white/10 active:scale-95">
                <input type="file" multiple onChange={(e) => e.target.files && processFiles(e.target.files, AssetType.MODEL)} className="hidden" />
                <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <ImageIcon className="w-5.5 h-5.5" />
                </div>
                <span className="text-[11px] font-bold opacity-60">Context Items</span>
              </label>
            </div>

            {assets.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar mt-4">
                {assets.map(asset => (
                  <div key={asset.id} className="relative shrink-0 w-16 h-16 rounded-ios-sm glass-card overflow-hidden group shadow-lg border border-white/20">
                    <img src={(bgRemovalEnabled && asset.isolatedUrl) ? asset.isolatedUrl : asset.url} className="w-full h-full object-cover" />
                    {asset.status === 'processing' && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-md">
                        <RefreshCw className="w-5 h-5 animate-spin text-ios-blue" />
                      </div>
                    )}
                    <button onClick={() => removeAsset(asset.id)} className="absolute top-0 right-0 p-1 bg-black/40 text-white rounded-bl-ios-sm hover:bg-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 02: Vision Engine - Head of Design Refinement */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="sidebar-section-title !mb-0">02 Vision Engine</h2>
              <button 
                onClick={handleAnalyzeAssets} 
                disabled={assets.length === 0 || isAnalyzing} 
                className="text-[10px] font-black text-ios-blue uppercase tracking-widest disabled:opacity-30 flex items-center gap-1.5"
                title="Deep Scan Assets for Agency Prompting"
              >
                {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                Smart Scan
              </button>
            </div>
            <div className="relative group">
              <textarea 
                value={selectedPrompt} 
                onChange={(e) => setSelectedPrompt(e.target.value)} 
                placeholder="Describe your creative vision..." 
                className="w-full glass-card rounded-ios p-5 text-[14px] font-medium leading-relaxed min-h-[140px] resize-none hover:bg-white/90 dark:hover:bg-white/10" 
              />
              <button 
                onClick={handleRefinePrompt} 
                disabled={!selectedPrompt || isRefining} 
                className="absolute bottom-5 right-5 w-10 h-10 bg-ios-blue/10 dark:bg-white/10 hover:bg-ios-blue hover:text-white flex items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-20 shadow-lg"
                title="Art Director Refinement (High Fidelity)"
              >
                {isRefining ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
              </button>
            </div>
          </section>

          {/* Section 03: Marketing Voice */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0.2s' }}>
             <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="sidebar-section-title !mb-0">03 Brand Voice</h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleClearCopy} 
                  className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1 hover:brightness-125"
                  title="Wipe Marketing Fields"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
                <button 
                  onClick={handleGenerateCopy} 
                  disabled={!selectedPrompt || isGeneratingCopy} 
                  className="text-[10px] font-black text-ios-blue uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-30"
                >
                  {isGeneratingCopy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
                  Generate Copy
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-ios p-5">
                <span className="text-[9px] font-black text-[#8e8e93] uppercase mb-1.5 block tracking-widest">Head of Strategy Hook</span>
                <input 
                  type="text"
                  value={marketingCopy.headline}
                  onChange={(e) => setMarketingCopy({...marketingCopy, headline: e.target.value})}
                  placeholder="The Master Hook..."
                  className="w-full bg-transparent text-[15px] font-extrabold focus:outline-none placeholder:opacity-30"
                />
              </div>
              <div className="glass-card rounded-ios p-5">
                <span className="text-[9px] font-black text-[#8e8e93] uppercase mb-1.5 block tracking-widest">Strategic Ad Copy</span>
                <textarea 
                  value={marketingCopy.caption}
                  onChange={(e) => setMarketingCopy({...marketingCopy, caption: e.target.value})}
                  placeholder="Platform-optimized brand story..."
                  className="w-full bg-transparent text-[13px] leading-relaxed min-h-[60px] resize-none focus:outline-none placeholder:opacity-30 font-medium"
                />
              </div>
            </div>
          </section>

          {/* Section 04: Resolution Matrix - Standardized h-20 height */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0.3s' }}>
            <h2 className="sidebar-section-title">04 Resolution Matrix</h2>
            <div className="ratio-grid">
              {ratioOptions.map(option => (
                <button 
                  key={option.label}
                  onClick={() => setAspectRatio(option.label)}
                  className={`h-20 flex flex-col items-center justify-center rounded-ios transition-all border ${
                    aspectRatio === option.label 
                      ? 'bg-ios-blue/10 border-ios-blue shadow-lg' 
                      : 'glass-card border-transparent hover:border-ios-blue/30'
                  } group active:scale-95`}
                  title={`${option.pixels} pixels`}
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className={`${aspectRatio === option.label ? 'text-ios-blue' : 'text-[#8e8e93]'} group-hover:scale-110 transition-transform`}>
                      {option.icon}
                    </div>
                    <span className={`text-[12px] font-bold truncate ${aspectRatio === option.label ? 'text-ios-blue' : 'opacity-80'}`}>
                      {option.label.split(' (')[0]}
                    </span>
                  </div>
                  <span className="text-[9px] text-[#8e8e93] font-black opacity-60 uppercase tracking-tighter">
                    {option.label.match(/\((.*?)\)/)?.[1]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Main Action - Aligned h-16 Standard */}
          <button 
            onClick={handleGeneratePoster} 
            disabled={isGeneratingPoster || assets.length === 0 || !selectedPrompt} 
            className="mt-4 h-16 ios-btn-primary rounded-ios text-[17px] font-black flex items-center justify-center gap-4 active:scale-95 disabled:opacity-30"
          >
            {isGeneratingPoster ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-current" />}
            {isGeneratingPoster ? "Synthesizing Design..." : "Generate Masterpiece"}
          </button>
        </aside>

        {/* Cinematic Stage */}
        <main className={`${activeTab === 'preview' ? 'flex' : 'hidden'} lg:flex flex-1 h-full flex-col items-center justify-center p-12 lg:p-20 overflow-hidden relative bg-[#f5f5f7] dark:bg-[#000000]`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,122,255,0.04)_0%,transparent_75%)] pointer-events-none" />

          <div className={`w-full h-full flex flex-col items-center justify-center transition-all duration-800 ${isGeneratingPoster ? 'opacity-0 scale-95 blur-2xl' : 'opacity-100 scale-100'}`}>
            <div className={`relative rounded-ios-xl overflow-hidden glass-card flex items-center justify-center w-full h-full shadow-2xl transition-all duration-700 border border-white/40 dark:border-white/10 ${
              aspectRatio.includes('(1:1)') ? 'aspect-square' :
              aspectRatio.includes('(4:5)') ? 'aspect-[4/5]' :
              aspectRatio.includes('(9:16)') ? 'aspect-[9/16]' : 'aspect-[16/9]'
            } max-w-full max-h-full p-3`}>
              
              {finalImage ? (
                <div className="w-full h-full group relative rounded-[22px] overflow-hidden">
                  <img src={finalImage} className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-xl">
                    <button onClick={() => handleDownload(finalImage!, `Export`)} className="w-24 h-24 bg-white/95 rounded-full flex items-center justify-center shadow-4xl active:scale-90 transition-all text-ios-blue hover:scale-110">
                      <Download className="w-11 h-11" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-10 opacity-15">
                  <div className="w-28 h-28 rounded-ios glass-card flex items-center justify-center text-ios-blue shadow-inner">
                    <Monitor className="w-14 h-14" />
                  </div>
                  <div className="text-center">
                    <p className="text-[22px] font-black uppercase tracking-[0.4em]">Neural Output Stage</p>
                    <p className="text-[13px] font-bold mt-2 opacity-60 uppercase">{aspectRatio}</p>
                  </div>
                </div>
              )}
            </div>
            
            {finalImage && (
              <div className="mt-12 flex gap-5 animate-pro-reveal">
                <button onClick={() => handleDownload(finalImage!, `Master_Export`)} className="px-12 py-5 bg-ios-blue text-white rounded-full text-[16px] font-black shadow-3xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-4">
                  Export Design <Download className="w-6 h-6" />
                </button>
                <button onClick={() => setActiveTab('studio')} className="px-12 py-5 glass-card text-[#1d1d1f] dark:text-white rounded-full text-[16px] font-black hover:bg-white/80 dark:hover:bg-white/10 active:scale-95 transition-all flex items-center gap-4">
                  New Variation <RotateCcw className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>

          {isGeneratingPoster && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-[300] animate-pro-reveal">
              <div className="relative">
                <div className="w-24 h-24 border-[6px] border-ios-blue/10 border-t-ios-blue rounded-full animate-spin"></div>
                <div className="absolute inset-0 m-auto w-10 h-10 bg-ios-blue/5 rounded-full flex items-center justify-center">
                   <Sparkles className="w-6 h-6 text-ios-blue animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[26px] font-black tracking-tighter titanium-text">Neural Art Direction</p>
                <p className="text-[12px] font-bold text-[#8e8e93] mt-2 tracking-widest uppercase opacity-60">Constructing Production Asset</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* History Slide Archive */}
      {showHistory && (
        <div className="fixed inset-0 z-[500] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xl transition-all duration-700" onClick={() => setShowHistory(false)} />
          <aside className="relative ml-auto w-full sm:w-[460px] h-full glass-nav shadow-[0_0_120px_rgba(0,0,0,0.6)] flex flex-col p-10 animate-pro-reveal border-l border-white/10">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-[36px] font-black tracking-tighter titanium-text">Archives</h2>
              <button onClick={() => setShowHistory(false)} className="w-12 h-12 flex items-center justify-center bg-black/5 dark:bg-white/10 rounded-full text-[#8e8e93] active:scale-90 transition-all"><X className="w-8 h-8" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-8 pb-32 ios-scrollbar pr-3">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-25 gap-8">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#8e8e93] flex items-center justify-center">
                    <History className="w-10 h-10" />
                  </div>
                  <p className="text-[18px] font-black uppercase tracking-widest">Dock Empty</p>
                </div>
              ) : (
                history.map(item => (
                  <div 
                    key={item.id} 
                    className="rounded-ios overflow-hidden glass-card cursor-pointer group hover:scale-[1.03] active:scale-[0.98] transition-all relative border border-white/10 shadow-xl" 
                  >
                    <div className="aspect-[16/10] relative" onClick={() => {
                      setFinalImage(item.imageUrl);
                      setShowHistory(false);
                      setActiveTab('preview');
                    }}>
                      <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                      <div className="absolute bottom-0 inset-x-0 p-5 bg-black/65 backdrop-blur-2xl border-t border-white/10">
                        <p className="text-white text-[12px] font-black truncate uppercase tracking-widest leading-tight">{item.prompt}</p>
                        <p className="text-white/45 text-[10px] font-bold mt-1.5 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleDateString()} — {item.ratio.split(' ')[0]}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDownload(item.imageUrl, `Archive_Export`); }} 
                      className="absolute top-4 right-4 w-11 h-11 bg-white/95 rounded-full flex items-center justify-center text-ios-blue shadow-3xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      title="Direct Production Export"
                    >
                      <Download className="w-6 h-6" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Global Pro Alert */}
      {error && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/50 backdrop-blur-3xl">
          <div className="w-full max-w-[340px] glass-card rounded-ios-lg overflow-hidden flex flex-col items-center text-center shadow-4xl animate-pro-reveal border border-white/10">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 mx-auto">
                <AlertCircle className="w-9 h-9 text-red-500" />
              </div>
              <h3 className="text-[22px] font-black mb-2 tracking-tight">Studio Alert</h3>
              <p className="text-[14px] leading-relaxed text-[#8e8e93] font-bold">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="w-full h-15 border-t border-black/5 dark:border-white/5 text-[17px] font-black text-ios-blue active:bg-black/5 hover:bg-ios-blue hover:text-white transition-all">Dismiss</button>
          </div>
        </div>
      )}

      {/* Mobile Tab Bridge - iPhone Dock Style */}
      <nav className="lg:hidden h-24 glass-nav flex items-center justify-around fixed bottom-0 w-full z-[400] pb-8 border-t border-black/[0.05]">
        <button onClick={() => setActiveTab('studio')} className={`flex flex-col items-center gap-1.5 transition-all w-1/2 ${activeTab === 'studio' ? 'text-ios-blue' : 'text-[#8e8e93]'}`}>
          <div className={`p-2.5 rounded-full ${activeTab === 'studio' ? 'bg-ios-blue/10 scale-125' : ''} transition-all`}>
            <Layers className="w-6.5 h-6.5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-tighter">Studio</span>
        </button>
        <button onClick={() => setActiveTab('preview')} className={`flex flex-col items-center gap-1.5 transition-all w-1/2 ${activeTab === 'preview' ? 'text-ios-blue' : 'text-[#8e8e93]'}`}>
          <div className={`p-2.5 rounded-full ${activeTab === 'preview' ? 'bg-ios-blue/10 scale-125' : ''} transition-all`}>
            <Monitor className="w-6.5 h-6.5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-tighter">Preview</span>
        </button>
      </nav>
    </div>
  );
};

export default App;