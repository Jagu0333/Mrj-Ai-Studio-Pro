import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Trash2,
  Edit3,
  Megaphone,
  Smartphone,
  CheckCircle2,
  PenTool,
  Clock,
  Menu,
  MonitorCheck
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

const LOADING_MESSAGES = [
  "Analyzing visual DNA...",
  "Applying Art Director's vision...",
  "Synthesizing material physics...",
  "Aligning brand typography...",
  "Color grading textures...",
  "Finalizing production asset...",
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
  { label: 'Custom', icon: Edit3, sub: '1920X1080' },
];

const App: React.FC = () => {
  const [subjectAsset, setSubjectAsset] = useState<Asset | null>(null);
  const [contextAsset, setContextAsset] = useState<Asset | null>(null);
  const [isProcessingCreative, setIsProcessingCreative] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Instagram Square (1:1)');
  const [marketingCopy, setMarketingCopy] = useState<MarketingCopy>({ headline: '', bodyCopy: '', cta: '' });
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'preview'>('studio');
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('studio-theme') === 'dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const desiredFullscreenRef = useRef(false);

  // Consolidated assets for API calls
  const allAssets = [subjectAsset, contextAsset].filter(Boolean) as Asset[];
  const isAnyProcessing = isProcessingCreative || isRefining || isGeneratingPoster || allAssets.some(a => a.status === 'processing');

  useEffect(() => {
    loadHistory();
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
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

  const toggleFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        desiredFullscreenRef.current = true;
        if (elem.requestFullscreen) await elem.requestFullscreen();
        else if ((elem as any).webkitRequestFullscreen) await (elem as any).webkitRequestFullscreen();
      } else {
        desiredFullscreenRef.current = false;
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
      }
    } catch (e) { console.warn("FS_ERR", e); }
  }, []);

  const handleIsolateSubject = async (asset: Asset, isSubject: boolean) => {
    if (isAnyProcessing) return;
    console.log(`[Action] Triggering Background Removal for asset ${asset.id}`);
    
    const updateAsset = (status: any, extra = {}) => {
      if (isSubject) setSubjectAsset(prev => prev ? { ...prev, status, ...extra } : null);
      else setContextAsset(prev => prev ? { ...prev, status, ...extra } : null);
    };

    updateAsset('processing');
    try {
      const res = await gemini.isolateSubject(asset);
      updateAsset('completed', { isolatedBase64: res.base64, isolatedUrl: res.url });
    } catch (err: any) {
      updateAsset('failed', { error: err.message });
      setError(err.message);
    }
  };

  const processFile = async (file: File, type: AssetType) => {
    if (isAnyProcessing) return;
    setError(null);
    try {
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
      
      const newAsset = await assetPromise;
      if (type === AssetType.PRODUCT) setSubjectAsset(newAsset);
      else setContextAsset(newAsset);

    } catch (e) { setError("Error reading file."); }
  };

  const loadHistory = async () => { setHistory(await db.getHistory()); };
  
  const handleCreativeIntelligence = async () => {
    if (isAnyProcessing || allAssets.length === 0) return;
    console.log("[Action] Consolidating Creative Analysis and Marketing Copy Generation into one API call.");
    setIsProcessingCreative(true);
    try {
      const { analysis, copy } = await gemini.getCreativeIntelligence(allAssets);
      setSelectedPrompt(analysis.suggestedPrompt);
      setMarketingCopy(copy);
    } catch (err: any) { setError(err.message); }
    finally { setIsProcessingCreative(false); }
  };

  const handleRefinePrompt = async () => {
    if (isAnyProcessing || !selectedPrompt) return;
    console.log("[Action] Refining Creative Directive.");
    setIsRefining(true);
    try {
      setSelectedPrompt(await gemini.refinePrompt(selectedPrompt, allAssets));
    } catch (err: any) { setError(err.message); }
    finally { setIsRefining(false); }
  };

  const handleGeneratePoster = async () => {
    if (isAnyProcessing || allAssets.length === 0 || !selectedPrompt) return;
    console.log("[Action] Initiating Master Poster Generation (Final Composition).");
    setIsGeneratingPoster(true);
    setActiveTab('preview');
    try {
      const img = await gemini.generatePoster(allAssets, selectedPrompt, aspectRatio, bgRemovalEnabled, marketingCopy);
      setFinalImage(img);
      await db.saveHistoryItem({ 
          id: Math.random().toString(36).substr(2, 9), imageUrl: img, prompt: selectedPrompt, copy: marketingCopy, ratio: aspectRatio, timestamp: Date.now() 
      });
      loadHistory();
    } catch (err: any) { setError(err.message); setActiveTab('studio'); }
    finally { setIsGeneratingPoster(false); }
  };

  const handleDownloadImage = (url: string, prefix: string = 'Master') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `MrJ_Studio_${prefix}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#000000] selection:bg-ios-blue selection:text-white">
      {/* HEADER: Exactly matching Screenshot 1 */}
      <header className="h-16 glass-nav px-6 lg:px-12 flex items-center justify-between z-[200]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ios-blue rounded-ios flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight titanium-text">MrJ Studio Pro</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ios-secondaryLabel opacity-60">ELITE AD SYNTHESIS</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-ios-sm">
          <button onClick={toggleFullscreen} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-ios-sm text-ios-blue transition-all active:scale-90">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-ios-sm text-ios-blue transition-all active:scale-90">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setShowHistory(true)} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-ios-sm text-ios-blue transition-all active:scale-90">
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        {/* SIDEBAR: Controls - Exactly matching Screenshots 1, 2, 4 */}
        <aside className={`${activeTab === 'studio' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[420px] h-full flex-col p-6 lg:p-8 gap-8 overflow-y-auto ios-scrollbar pb-32 border-r border-black/[0.05] dark:border-white/[0.05]`}>
          
          {/* 01 STUDIO ASSETS */}
          <section className="animate-pro-reveal">
            <div className="flex items-center justify-between mb-4">
              <h2 className="sidebar-section-title !mb-0">01 STUDIO ASSETS</h2>
              <button 
                onClick={() => setBgRemovalEnabled(!bgRemovalEnabled)} 
                disabled={isAnyProcessing}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 transition-all ${bgRemovalEnabled ? 'bg-[#34C759] text-white shadow-md' : 'bg-transparent border border-gray-400 text-gray-500'}`}
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${bgRemovalEnabled ? 'opacity-100' : 'opacity-30'}`} />
                BG Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className={`h-32 rounded-ios glass-card flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/90 dark:hover:bg-white/10 transition-all active:scale-95 group ${isAnyProcessing ? 'opacity-30' : ''}`}>
                <input type="file" disabled={isAnyProcessing} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], AssetType.PRODUCT)} className="hidden" />
                <PlusCircle className="w-7 h-7 text-ios-blue" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">MAIN SUBJECT</span>
              </label>
              <label className={`h-32 rounded-ios glass-card flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/90 dark:hover:bg-white/10 transition-all active:scale-95 group ${isAnyProcessing ? 'opacity-30' : ''}`}>
                <input type="file" disabled={isAnyProcessing} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], AssetType.MODEL)} className="hidden" />
                <ImageIcon className="w-7 h-7 text-purple-500" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">CONTEXT/ENV</span>
              </label>
            </div>
            {allAssets.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mt-4 no-scrollbar">
                {allAssets.map(asset => (
                  <div key={asset.id} className="relative shrink-0 w-20 h-20 rounded-ios-sm glass-card overflow-hidden group border border-white/20">
                    <img src={(bgRemovalEnabled && asset.isolatedUrl) ? asset.isolatedUrl : asset.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <button onClick={() => asset.type === AssetType.PRODUCT ? setSubjectAsset(null) : setContextAsset(null)} className="p-1.5 bg-red-500 text-white rounded-full"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 02 VISION ENGINE */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="sidebar-section-title !mb-0">02 VISION ENGINE</h2>
              <button onClick={handleCreativeIntelligence} disabled={allAssets.length === 0 || isAnyProcessing} className="text-[10px] font-black text-ios-blue uppercase disabled:opacity-30 flex items-center gap-1.5 hover:brightness-110">
                <BrainCircuit className="w-4 h-4" />
                SMART SCAN
              </button>
            </div>
            <div className="relative">
              <textarea 
                value={selectedPrompt} 
                onChange={(e) => setSelectedPrompt(e.target.value)} 
                disabled={isAnyProcessing}
                placeholder="Synthesize your visual directive..." 
                className="w-full glass-card rounded-ios p-6 text-[14px] min-h-[140px] focus:outline-none focus:ring-1 focus:ring-ios-blue/30 ios-scrollbar disabled:opacity-50" 
              />
              <button 
                onClick={handleRefinePrompt} 
                disabled={!selectedPrompt || isAnyProcessing} 
                className="absolute bottom-5 right-5 w-10 h-10 bg-black/5 dark:bg-white/10 rounded-full text-ios-blue flex items-center justify-center hover:bg-ios-blue hover:text-white transition-all active:scale-90" 
              >
                {isRefining ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
              </button>
            </div>
          </section>

          {/* 03 BRAND VOICE */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="sidebar-section-title !mb-0">03 BRAND VOICE</h2>
              <div className="flex items-center gap-4">
                <button onClick={() => setMarketingCopy({ headline: '', bodyCopy: '', cta: '' })} disabled={isAnyProcessing} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-1.5 hover:brightness-125 disabled:opacity-30">
                  <Trash2 className="w-3.5 h-3.5" /> CLEAR
                </button>
                <button onClick={handleCreativeIntelligence} disabled={allAssets.length === 0 || isAnyProcessing} className="text-[10px] font-black text-ios-blue uppercase flex items-center gap-1.5 hover:brightness-110 disabled:opacity-30">
                  <PenTool className="w-3.5 h-3.5" /> SMART COPY
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="glass-card rounded-ios p-4">
                <span className="text-[9px] font-black text-ios-secondaryLabel uppercase block tracking-widest mb-1.5 flex items-center gap-1.5"><Zap className="w-3 h-3 text-ios-blue" /> VIRAL HEADLINE HOOK (ON POSTER)</span>
                <input value={marketingCopy.headline} disabled={isAnyProcessing} onChange={(e) => setMarketingCopy({...marketingCopy, headline: e.target.value})} placeholder="The Elite Hook..." className="w-full bg-transparent text-[14px] font-bold focus:outline-none disabled:opacity-50" />
              </div>
              <div className="glass-card rounded-ios p-4">
                <span className="text-[9px] font-black text-ios-secondaryLabel uppercase block tracking-widest mb-1.5 flex items-center gap-1.5"><Megaphone className="w-3 h-3 text-purple-500" /> SOCIAL BODY COPY (NOT IN POSTER)</span>
                <textarea value={marketingCopy.bodyCopy} disabled={isAnyProcessing} onChange={(e) => setMarketingCopy({...marketingCopy, bodyCopy: e.target.value})} placeholder="Elite social media caption..." className="w-full bg-transparent text-[13px] min-h-[80px] focus:outline-none resize-none ios-scrollbar disabled:opacity-50" />
              </div>
              <div className="glass-card rounded-ios p-4">
                <span className="text-[9px] font-black text-ios-secondaryLabel uppercase block tracking-widest mb-1.5 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 text-ios-blue" /> CALL TO ACTION (ON POSTER)</span>
                <input value={marketingCopy.cta} disabled={isAnyProcessing} onChange={(e) => setMarketingCopy({...marketingCopy, cta: e.target.value})} placeholder="e.g., Secure Yours Now..." className="w-full bg-transparent text-[14px] font-bold text-ios-blue focus:outline-none disabled:opacity-50" />
              </div>
            </div>
          </section>

          {/* 04 RESOLUTION MATRIX */}
          <section className="animate-pro-reveal" style={{ animationDelay: '0.3s' }}>
            <h2 className="sidebar-section-title">04 RESOLUTION MATRIX</h2>
            <div className="grid grid-cols-2 gap-3">
              {RATIO_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = aspectRatio === opt.label;
                return (
                  <button 
                    key={opt.label} 
                    onClick={() => setAspectRatio(opt.label)}
                    disabled={isAnyProcessing}
                    className={`h-24 glass-card rounded-ios flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] ${isActive ? 'ring-2 ring-ios-blue bg-ios-blue/5 shadow-[inset_0_0_15px_rgba(0,122,255,0.05)]' : 'hover:bg-white/80 dark:hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-ios-blue' : 'text-ios-secondaryLabel opacity-60'}`} />
                      <span className={`text-[12px] font-bold ${isActive ? 'text-ios-blue' : 'text-ios-label'}`}>{opt.label.split(' (')[0]}</span>
                    </div>
                    <span className="text-[10px] font-black text-ios-titanium opacity-60 uppercase tracking-widest">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* GENERATE MASTERPIECE BUTTON: Fixed in sidebar scrolling area like Screenshot 4 */}
          <button 
            onClick={handleGeneratePoster} 
            disabled={isAnyProcessing || allAssets.length === 0 || !selectedPrompt} 
            className="mt-4 h-14 ios-btn-primary rounded-full text-[15px] font-black flex items-center justify-center gap-3 active:scale-95 shadow-xl disabled:opacity-30"
          >
            {isGeneratingPoster ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-white" />}
            Generate Masterpiece
          </button>
        </aside>

        {/* MAIN PREVIEW AREA: Exactly matching Screenshots 1, 2, 3 */}
        <main className="flex-1 h-full flex flex-col items-center justify-center p-8 lg:p-12 overflow-hidden relative bg-[#f2f2f7] dark:bg-[#1c1c1e]">
          {/* X Button at the top like Screenshot 1 */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[300]">
            <button 
               onClick={() => setFinalImage(null)}
               className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Right floating menu icon like Screenshot 1 */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 z-[300] hidden lg:block">
            <button className="w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-white shadow-lg">
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className={`relative rounded-[44px] overflow-hidden bg-white dark:bg-black/40 flex items-center justify-center w-full max-w-4xl h-full shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] transition-all duration-700 ${isGeneratingPoster ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100'} p-8 border border-white dark:border-white/5`}>
            {finalImage ? (
              <div className="w-full h-full group relative rounded-[32px] overflow-hidden">
                <img src={finalImage} className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-6 backdrop-blur-md">
                  <button onClick={() => handleDownloadImage(finalImage)} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-ios-blue shadow-2xl active:scale-90 hover:scale-110 transition-all"><Download className="w-8 h-8" /></button>
                  <button onClick={() => setActiveTab('studio')} className="w-16 h-16 bg-ios-blue rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 hover:scale-110 transition-all"><Edit3 className="w-8 h-8" /></button>
                </div>
              </div>
            ) : (
              <div className="text-center opacity-20 flex flex-col items-center gap-6">
                <div className="w-20 h-20 text-ios-blue/40"><Monitor className="w-full h-full" /></div>
                <div>
                   <p className="text-[28px] font-black uppercase tracking-[0.4em] titanium-text mb-2">NEURAL OUTPUT STAGE</p>
                   <p className="text-[12px] font-bold uppercase tracking-widest text-ios-secondaryLabel">{aspectRatio.toUpperCase()}</p>
                </div>
              </div>
            )}
          </div>

          {isGeneratingPoster && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-[1000] bg-[#f2f2f7]/60 dark:bg-[#1c1c1e]/60 backdrop-blur-2xl animate-pro-reveal text-center">
              <div className="relative">
                <div className="w-36 h-36 border-[12px] border-ios-blue/10 border-t-ios-blue rounded-full animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto w-12 h-12 text-ios-blue animate-pulse" />
              </div>
              <div className="space-y-3">
                <p className="text-[24px] font-black tracking-tighter titanium-text uppercase">Synthesizing Creative</p>
                <p className="text-[13px] font-bold text-ios-secondaryLabel uppercase tracking-[0.2em]">{LOADING_MESSAGES[loadingStep]}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM NAV BAR: Matches Screenshot 1 and 3 */}
      <nav className="h-20 glass-nav flex items-center justify-around fixed bottom-0 w-full z-[400] border-t border-black/[0.05] dark:border-white/[0.05]">
        <button 
          onClick={() => setActiveTab('studio')} 
          className={`flex flex-col items-center gap-1.5 transition-all w-24 ${activeTab === 'studio' ? 'text-ios-blue scale-110' : 'text-ios-secondaryLabel opacity-40 hover:opacity-100'}`}
        >
          <Layers className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-widest">STUDIO</span>
        </button>
        <button 
          onClick={() => setActiveTab('preview')} 
          className={`flex flex-col items-center gap-1.5 transition-all w-24 ${activeTab === 'preview' ? 'text-ios-blue scale-110' : 'text-ios-secondaryLabel opacity-40 hover:opacity-100'}`}
        >
          <Monitor className="w-7 h-7" />
          <span className="text-[10px] font-black uppercase tracking-widest">PREVIEW</span>
        </button>
      </nav>

      {/* SYSTEM ALERT MODAL */}
      {error && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="w-full max-w-sm glass-card rounded-[32px] p-10 text-center animate-pro-reveal border border-white/20 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto"><AlertCircle className="w-8 h-8 text-red-500" /></div>
            <h3 className="text-[20px] font-black mb-2">Studio System Alert</h3>
            <p className="text-[13px] text-ios-secondaryLabel font-bold mb-8">{error}</p>
            <button onClick={() => setError(null)} className="w-full h-12 bg-ios-blue text-white rounded-full font-black active:scale-95 shadow-lg">Acknowledged</button>
          </div>
        </div>
      )}

      {/* ARCHIVES / HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 z-[500] flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-lg transition-all" onClick={() => setShowHistory(false)} />
          <aside className="relative ml-auto w-full sm:w-[460px] h-full glass-nav shadow-2xl flex flex-col p-8 lg:p-10 animate-pro-reveal border-l border-white/10">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-[28px] font-extrabold tracking-tighter titanium-text uppercase">Studio Archives</h2>
              <button onClick={() => setShowHistory(false)} className="w-10 h-10 flex items-center justify-center bg-black/5 dark:bg-white/10 rounded-full text-ios-secondaryLabel hover:text-red-500"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 ios-scrollbar pr-2">
              {history.map(item => (
                <div key={item.id} className="rounded-ios overflow-hidden glass-card border border-white/10 group relative shadow-md">
                  <img src={item.imageUrl} className="w-full aspect-video object-cover cursor-pointer hover:scale-105 transition-all duration-700" onClick={() => { setFinalImage(item.imageUrl); setShowHistory(false); setActiveTab('preview'); }} />
                  <div className="p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest truncate mb-1.5">{item.prompt}</p>
                    <p className="text-[9px] text-ios-titanium font-black uppercase flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDownloadImage(item.imageUrl)} className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-ios-blue shadow-xl opacity-0 group-hover:opacity-100 transition-all"><Download className="w-5 h-5" /></button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default App;