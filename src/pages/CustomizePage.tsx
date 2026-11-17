import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Eye,
  EyeOff,
  Gamepad2,
  Home,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Palette,
  Play,
  RotateCcw,
  Tv,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { GameSyncProvider, useGameSync } from '../context/GameSyncContext';
import { OwnerAuthGate } from '../components/OwnerAuthGate';
import { StudioStageView } from '../components/StudioStageView';
import { OceanicBackdrop } from '../components/OceanicBackdrop';
import { CategoryBadgeArtwork } from '../components/BroadcastArtwork';
import {
  MINI_GAME_CATEGORIES,
  MiniGameCategory,
  StudioCustomization,
  clampIconScale,
  resolveCustomMiniGameIcon,
  resolveMiniGameIconScale,
  resolveShowLogoScale,
} from '../types/game';

type CustomizerTab = 'icons' | 'stage' | 'teams';

const SCALE_PRESETS = [0.75, 1, 1.25, 1.5];

const ACCENT_SWATCHES = [
  { label: 'Broadcast Cyan', hex: '#4DB8FF' },
  { label: 'Broadcast Gold', hex: '#F59E0B' },
  { label: 'Coral Pink', hex: '#FB7185' },
  { label: 'Pitch Emerald', hex: '#10B981' },
  { label: 'Royal Violet', hex: '#A78BFA' },
];

const IMAGE_ACCEPT_ATTR =
  'image/png,image/webp,image/svg+xml,image/jpeg,image/gif,.png,.webp,.svg,.jpg,.jpeg,.gif';

function isPngFile(file: File): boolean {
  return file.type === 'image/png' || /\.png$/i.test(file.name);
}

function isAlphaCapableImage(file: File): boolean {
  return (
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    /\.(png|webp|svg|gif)$/i.test(file.name)
  );
}

function isSupportedImageFile(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    /\.(png|webp|svg|gif|jpe?g)$/i.test(file.name)
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image file'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

async function compressImageToDataUrl(
  file: File,
  maxDim: number,
  preserveTransparency: boolean
): Promise<string> {
  if (file.type === 'image/svg+xml' && file.size <= 120 * 1024) {
    return readFileAsDataUrl(file);
  }

  const keepAlpha = preserveTransparency || isAlphaCapableImage(file);
  const isPng = isPngFile(file);

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        // Keep compact PNG alpha files completely untouched (100% lossless alpha & edges)
        if (isPng && file.size <= 180 * 1024 && img.width <= maxDim && img.height <= maxDim) {
          URL.revokeObjectURL(objectUrl);
          resolve(await readFileAsDataUrl(file));
          return;
        }

        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);

        if (keepAlpha) {
          if (isPng) {
            const pngUrl = canvas.toDataURL('image/png');
            if (pngUrl.length <= 260 * 1024) {
              resolve(pngUrl);
              return;
            }
            const webpAlphaUrl = canvas.toDataURL('image/webp', 0.9);
            if (webpAlphaUrl.startsWith('data:image/webp')) {
              resolve(webpAlphaUrl);
              return;
            }
            resolve(pngUrl);
            return;
          }

          const webpUrl = canvas.toDataURL('image/webp', 0.88);
          if (webpUrl.startsWith('data:image/webp')) {
            resolve(webpUrl);
          } else {
            resolve(canvas.toDataURL('image/png'));
          }
        } else {
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        }
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = async () => {
      URL.revokeObjectURL(objectUrl);
      try {
        resolve(await readFileAsDataUrl(file));
      } catch (err) {
        reject(err);
      }
    };
    img.src = objectUrl;
  });
}

const CustomizeBody: React.FC = () => {
  const { state, ownerAuth, logoutOwner, sendHostAction } = useGameSync();
  const [activeTab, setActiveTab] = useState<CustomizerTab>('icons');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Text form drafts synchronized from state.customization
  const custom = state?.customization || {};
  const [eyebrowDraft, setEyebrowDraft] = useState(custom.showEyebrow ?? 'STUDIO BROADCAST SHOW');
  const [primaryTitleDraft, setPrimaryTitleDraft] = useState(custom.showTitlePrimary ?? 'FANZONE');
  const [secondaryTitleDraft, setSecondaryTitleDraft] = useState(custom.showTitleSecondary ?? 'LIVE');
  const [showLogoUrlDraft, setShowLogoUrlDraft] = useState(custom.showLogoUrl ?? '');
  const [stageBgUrlDraft, setStageBgUrlDraft] = useState(custom.stageBgUrl ?? '');
  const [globalCardBgUrlDraft, setGlobalCardBgUrlDraft] = useState(
    custom.cardFrontBgUrl ?? custom.cardBackBgUrl ?? ''
  );
  const [redNameDraft, setRedNameDraft] = useState(custom.redTeamName ?? 'RED TEAM');
  const [redLogoUrlDraft, setRedLogoUrlDraft] = useState(custom.redTeamLogoUrl ?? '');
  const [blueNameDraft, setBlueNameDraft] = useState(custom.blueTeamName ?? 'BLUE TEAM');
  const [blueLogoUrlDraft, setBlueLogoUrlDraft] = useState(custom.blueTeamLogoUrl ?? '');
  const [miniGameUrlOpen, setMiniGameUrlOpen] = useState<Record<string, boolean>>({});
  const [miniGameIconUrlDrafts, setMiniGameIconUrlDrafts] = useState<Record<string, string>>({});
  const [miniGameScaleDrafts, setMiniGameScaleDrafts] = useState<Record<string, number>>({});
  const [globalMiniGameScaleDraft, setGlobalMiniGameScaleDraft] = useState<number>(
    clampIconScale(custom.miniGameIconScale, 1)
  );
  const [showLogoScaleDraft, setShowLogoScaleDraft] = useState<number>(
    resolveShowLogoScale(custom)
  );

  const statusTimerRef = useRef<number | null>(null);
  const scaleDebounceRef = useRef<Record<string, number>>({});

  const showToast = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatusMessage(null), 2600);
  };

  // Sync local drafts when external customization changes
  useEffect(() => {
    setEyebrowDraft(custom.showEyebrow ?? 'STUDIO BROADCAST SHOW');
    setPrimaryTitleDraft(custom.showTitlePrimary ?? 'FANZONE');
    setSecondaryTitleDraft(custom.showTitleSecondary ?? 'LIVE');
    setShowLogoUrlDraft(custom.showLogoUrl ?? '');
    setStageBgUrlDraft(custom.stageBgUrl ?? '');
    setGlobalCardBgUrlDraft(custom.cardFrontBgUrl ?? custom.cardBackBgUrl ?? '');
    setRedNameDraft(custom.redTeamName ?? 'RED TEAM');
    setRedLogoUrlDraft(custom.redTeamLogoUrl ?? '');
    setBlueNameDraft(custom.blueTeamName ?? 'BLUE TEAM');
    setBlueLogoUrlDraft(custom.blueTeamLogoUrl ?? '');
    setGlobalMiniGameScaleDraft(clampIconScale(custom.miniGameIconScale, 1));
    setShowLogoScaleDraft(resolveShowLogoScale(custom));

    const mgUrls: Record<string, string> = {};
    const mgScales: Record<string, number> = {};
    MINI_GAME_CATEGORIES.forEach((item) => {
      mgUrls[item.category] = custom.miniGameIcons?.[item.category] ?? '';
      mgScales[item.category] = resolveMiniGameIconScale(custom, item.category);
    });
    setMiniGameIconUrlDrafts(mgUrls);
    setMiniGameScaleDrafts(mgScales);
  }, [
    custom.showEyebrow,
    custom.showTitlePrimary,
    custom.showTitleSecondary,
    custom.showLogoUrl,
    custom.showLogoScale,
    custom.hideShowTitleText,
    custom.stageBgUrl,
    custom.cardFrontBgUrl,
    custom.cardBackBgUrl,
    custom.redTeamName,
    custom.redTeamLogoUrl,
    custom.blueTeamName,
    custom.blueTeamLogoUrl,
    custom.miniGameIconScale,
    custom.miniGameIcons,
    custom.miniGameIconScales,
  ]);

  const applyCustomization = async (
    patch: Partial<StudioCustomization>,
    message = 'Studio Monitor updated'
  ) => {
    setErrorMessage(null);
    try {
      await sendHostAction('customization:update', { customization: patch });
      showToast(message);
    } catch {
      setErrorMessage('Could not sync update to Studio Monitor. Check connection and try again.');
    }
  };

  const uploadStudioAsset = async (
    file: File,
    uploadKey: string,
    opts: { maxDim: number; preserveTransparency: boolean }
  ): Promise<string | null> => {
    if (!isSupportedImageFile(file)) {
      setErrorMessage('Please select an image file (PNG with alpha, WebP, JPG, SVG, or GIF).');
      return null;
    }

    setUploadingKey(uploadKey);
    setErrorMessage(null);

    try {
      // Try server disk upload first (ideal for Node / Cloud Run)
      if (ownerAuth.token && file.size <= 4 * 1024 * 1024) {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch('/api/content/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerAuth.token}` },
          body: formData,
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.mediaUrl) {
            return data.mediaUrl as string;
          }
        }
      }
    } catch {
      // Fall back to compressed DataURL below for serverless / Vercel environments
    }

    try {
      const compressed = await compressImageToDataUrl(
        file,
        opts.maxDim,
        opts.preserveTransparency
      );
      return compressed;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to process image upload.');
      return null;
    } finally {
      setUploadingKey(null);
    }
  };

  const handleUploadGlobalAsset = async (
    field:
      | 'showLogoUrl'
      | 'stageBgUrl'
      | 'cardFrontBgUrl'
      | 'cardBackBgUrl'
      | 'redTeamLogoUrl'
      | 'blueTeamLogoUrl',
    file: File,
    opts: { maxDim: number; preserveTransparency: boolean },
    label: string
  ) => {
    const url = await uploadStudioAsset(file, field, opts);
    setUploadingKey(null);
    if (!url) return;
    if (field === 'cardFrontBgUrl') {
      await applyCustomization(
        { cardFrontBgUrl: url, cardBackBgUrl: url },
        `${label} updated on Studio Monitor`
      );
      return;
    }
    await applyCustomization({ [field]: url }, `${label} updated on Studio Monitor`);
  };

  const applyMiniGameIcon = async (
    category: MiniGameCategory,
    url: string,
    title: string
  ) => {
    await applyCustomization(
      { miniGameIcons: { [category]: url } },
      url
        ? `${title} mini-game icon updated`
        : `${title} mini-game icon restored to default`
    );
  };

  const handleUploadMiniGameIcon = async (
    category: MiniGameCategory,
    title: string,
    file: File
  ) => {
    const url = await uploadStudioAsset(file, `minigame-icon-${category}`, {
      maxDim: 320,
      preserveTransparency: true,
    });
    setUploadingKey(null);
    if (!url) return;
    await applyMiniGameIcon(category, url, title);
  };

  const scheduleScaleSync = (key: string, fn: () => void, immediate = false) => {
    const existing = scaleDebounceRef.current[key];
    if (existing) window.clearTimeout(existing);
    if (immediate) {
      fn();
      return;
    }
    scaleDebounceRef.current[key] = window.setTimeout(fn, 140);
  };

  const handleGlobalMiniGameScaleChange = (val: number, immediate = false) => {
    const clamped = clampIconScale(val, 1);
    setGlobalMiniGameScaleDraft(clamped);
    scheduleScaleSync(
      'global-mg-scale',
      () =>
        applyCustomization(
          { miniGameIconScale: clamped },
          `Mini-game icon scale set to ${Math.round(clamped * 100)}%`
        ),
      immediate
    );
  };

  const handleMiniGameScaleChange = (
    category: MiniGameCategory,
    title: string,
    val: number | undefined,
    immediate = false
  ) => {
    if (val === undefined) {
      setMiniGameScaleDrafts((prev) => ({
        ...prev,
        [category]: globalMiniGameScaleDraft,
      }));
      scheduleScaleSync(
        `mg-scale-${category}`,
        () =>
          applyCustomization(
            { miniGameIconScales: { [category]: 0 } },
            `${title} icon scale reset to global`
          ),
        true
      );
      return;
    }
    const clamped = clampIconScale(val, 1);
    setMiniGameScaleDrafts((prev) => ({ ...prev, [category]: clamped }));
    scheduleScaleSync(
      `mg-scale-${category}`,
      () =>
        applyCustomization(
          { miniGameIconScales: { [category]: clamped } },
          `${title} icon scale set to ${Math.round(clamped * 100)}%`
        ),
      immediate
    );
  };

  const handleShowLogoScaleChange = (val: number, immediate = false) => {
    const clamped = clampIconScale(val, 1);
    setShowLogoScaleDraft(clamped);
    scheduleScaleSync(
      'show-logo-scale',
      () =>
        applyCustomization(
          { showLogoScale: clamped },
          `Show logo scale set to ${Math.round(clamped * 100)}%`
        ),
      immediate
    );
  };

  if (!state) {
    return (
      <div className="relative min-h-screen bg-[#040F1A] text-white flex items-center justify-center font-['Unbounded'] overflow-hidden">
        <OceanicBackdrop fixed />
        <div className="relative z-10 glass-panel glass-noise rounded-2xl px-8 py-6 text-lg font-bold text-[#4DB8FF]">
          Loading Studio Customizer...
        </div>
      </div>
    );
  }

  const activeAccent = custom.cardAccentColor || '#4DB8FF';
  const hideEmojiLabels = Boolean(custom.hideEmojiLabels);

  return (
    <div className="relative min-h-screen bg-[#040F1A] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans']">
      <OceanicBackdrop fixed />

      {/* Top Bar Contract: 3 Zones Separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3 glass-header">
        <Link
          to="/customize"
          className="text-lg font-extrabold font-['Unbounded'] tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <span className="text-[#4DB8FF]">FanZone</span> Studio Customizer
        </Link>

        <nav className="flex items-center gap-6 text-sm font-semibold text-slate-300 font-['Chakra_Petch'] overflow-x-auto">
          <Link
            to="/host"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Host Console
          </Link>
          <Link
            to="/content"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Content Manager
          </Link>
          <Link
            to="/customize"
            className="text-[#4DB8FF] hover:text-[#7DD3FC] transition-colors whitespace-nowrap shrink-0"
          >
            Studio Customizer
          </Link>
          <Link
            to="/studio"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#4DB8FF] transition-colors whitespace-nowrap shrink-0"
          >
            Studio Display
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={logoutOwner}
            className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-200 glass-panel-deep rounded-xl hover:border-[#4DB8FF]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Two-Column Responsive Workspace */}
      <main className="relative z-10 flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (5 cols): Live 16:9 Studio Monitor Preview + Quick Stage Controls */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 flex flex-col gap-4">
          <section className="glass-panel glass-noise rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-base font-bold font-['Unbounded'] text-white">
                  Live Studio Monitor Preview
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Changes sync instantly to /studio and Host Monitor
                </p>
              </div>
              <Link
                to="/studio"
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-bold text-[#7DD3FC] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Tv className="w-3.5 h-3.5 shrink-0" />
                <span>Open /studio</span>
              </Link>
            </div>

            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-[#5EC8FF]/25">
              <StudioStageView state={state} isPreview={true} />
            </div>

            {/* Quick Stage Switcher for Previewing Home Screen vs 2x4 Card Board */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => sendHostAction('stage:showHome')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  state.stage === 'home'
                    ? 'bg-[#4DB8FF]/20 border border-[#4DB8FF] text-[#7DD3FC]'
                    : 'glass-panel-deep hover:border-[#4DB8FF]/60 text-slate-200'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Preview Home Screen</span>
              </button>

              <button
                type="button"
                onClick={() => sendHostAction('stage:revealBoard')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  state.stage === 'board'
                    ? 'bg-[#34D399]/20 border border-[#34D399] text-[#34D399]'
                    : 'glass-panel-deep hover:border-[#34D399]/60 text-slate-200'
                }`}
              >
                <Play className="w-4 h-4 shrink-0" />
                <span>Preview 2×4 Card Board</span>
              </button>
            </div>

            {/* Quick Home Screen Show Logo (PNG Alpha) Control */}
            <div className="p-3 rounded-xl glass-panel-deep space-y-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-[radial-gradient(#1e4e6e_1px,transparent_1px)] [background-size:8px_8px] bg-[#04111E]/80 border border-[#5EC8FF]/30 flex items-center justify-center overflow-hidden p-1 shrink-0">
                    {custom.showLogoUrl ? (
                      <img
                        src={custom.showLogoUrl}
                        alt="Show PNG logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#4DB8FF]/60" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      Show Logo (PNG Alpha)
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {custom.showLogoUrl
                        ? 'Custom transparent PNG active on Home Screen'
                        : 'Upload PNG logo to replace Home Screen crest'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {uploadingKey === 'showLogoUrl'
                        ? 'Uploading...'
                        : custom.showLogoUrl
                          ? 'Replace PNG'
                          : 'Upload PNG'}
                    </span>
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT_ATTR}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleUploadGlobalAsset(
                            'showLogoUrl',
                            f,
                            { maxDim: 1280, preserveTransparency: true },
                            'Show PNG logo'
                          );
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {custom.showLogoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization({ showLogoUrl: '' }, 'Custom show logo removed')
                      }
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#2B1424]/75 border border-[#FB6F84]/40 text-xs font-bold text-[#FB6F84] hover:text-rose-200 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {custom.showLogoUrl && (
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[#5EC8FF]/15">
                  <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                    <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                      Scale
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={1.8}
                      step={0.05}
                      value={showLogoScaleDraft}
                      onChange={(e) =>
                        handleShowLogoScaleChange(Number(e.target.value), false)
                      }
                      className="flex-1 accent-[#4DB8FF] cursor-pointer"
                    />
                    <span className="text-[11px] font-bold font-['Chakra_Petch'] tabular-nums text-[#7DD3FC] w-10 text-right">
                      {Math.round(showLogoScaleDraft * 100)}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const currentlyHidden = custom.hideShowTitleText !== false;
                      applyCustomization(
                        { hideShowTitleText: !currentlyHidden },
                        currentlyHidden
                          ? 'Title text shown below PNG logo'
                          : 'Displaying PNG logo only on Home Screen'
                      );
                    }}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-colors ${
                      custom.hideShowTitleText !== false
                        ? 'bg-[#4DB8FF]/20 border-[#4DB8FF] text-[#7DD3FC]'
                        : 'border-[#5EC8FF]/25 text-slate-300 hover:text-white'
                    }`}
                  >
                    {custom.hideShowTitleText !== false ? (
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{custom.hideShowTitleText !== false ? 'PNG Logo Only' : 'Show + Title Text'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Feedback Banner */}
            {(statusMessage || errorMessage) && (
              <div
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 backdrop-blur-md ${
                  errorMessage
                    ? 'bg-[#3B1324]/75 border border-[#FB6F84]/60 text-rose-200'
                    : 'bg-[#062E26]/75 border border-[#34D399]/60 text-emerald-200'
                }`}
              >
                <span>{errorMessage || statusMessage}</span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStatusMessage(null);
                  }}
                  className="p-1 hover:text-white cursor-pointer shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </section>

          {/* Reset All Customizations Panel */}
          <section className="glass-panel glass-noise rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold font-['Unbounded'] text-white">
                Default Broadcast Branding
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Restore all game icons, card covers, titles, and team logos to defaults.
              </p>
            </div>
            {!confirmResetAll ? (
              <button
                type="button"
                onClick={() => setConfirmResetAll(true)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl glass-panel-deep hover:bg-[#FB6F84]/20 hover:border-[#FB6F84]/60 text-xs font-bold text-slate-200 hover:text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Reset All</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmResetAll(false);
                    try {
                      await sendHostAction('customization:reset');
                      showToast('Restored default Studio Monitor graphics');
                    } catch {
                      setErrorMessage('Failed to reset customizations.');
                    }
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#FB6F84] hover:bg-rose-400 text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs font-semibold text-slate-300 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (7 cols): Customization Tabs */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Tab Switcher */}
          <div className="grid grid-cols-3 gap-2 p-2 glass-panel glass-noise rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('icons')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'icons'
                  ? 'bg-[#4DB8FF] text-slate-950 shadow-[0_0_20px_rgba(77,184,255,0.28)]'
                  : 'text-slate-300 hover:text-white hover:bg-[#0D3350]/55'
              }`}
            >
              <Gamepad2 className="w-4 h-4 shrink-0" />
              <span>Game Icon Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stage')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'stage'
                  ? 'bg-[#4DB8FF] text-slate-950 shadow-[0_0_20px_rgba(77,184,255,0.28)]'
                  : 'text-slate-300 hover:text-white hover:bg-[#0D3350]/55'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Show Title & Stage</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'teams'
                  ? 'bg-[#4DB8FF] text-slate-950 shadow-[0_0_20px_rgba(77,184,255,0.28)]'
                  : 'text-slate-300 hover:text-white hover:bg-[#0D3350]/55'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Teams & Colors</span>
            </button>
          </div>

          {/* TAB 1: GAME ICON CARDS & CARD DESIGN */}
          {activeTab === 'icons' && (
            <div className="space-y-5">
              {/* Global Card Design & Accent */}
              <section className="glass-panel glass-noise rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold font-['Unbounded'] text-white">
                      Card Design & Selection Accent
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Background artwork, selection glow, and title visibility for the 2×4 Game Icon Cards
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      applyCustomization(
                        { hideEmojiLabels: !hideEmojiLabels },
                        hideEmojiLabels ? 'Card titles shown' : 'Card titles hidden'
                      )
                    }
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      hideEmojiLabels
                        ? 'glass-panel-deep text-slate-300'
                        : 'bg-[#4DB8FF]/15 border-[#4DB8FF]/55 text-[#7DD3FC]'
                    }`}
                  >
                    {hideEmojiLabels ? (
                      <>
                        <EyeOff className="w-4 h-4 shrink-0" />
                        <span>Card Titles Hidden</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 shrink-0" />
                        <span>Card Titles Visible</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Global Card Background */}
                <div className="p-3 rounded-xl glass-panel-deep space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Card Background Artwork (Applies to all 8 cards)
                    </span>
                    {(custom.cardFrontBgUrl || custom.cardBackBgUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          applyCustomization(
                            { cardFrontBgUrl: '', cardBackBgUrl: '' },
                            'Card background cleared'
                          )
                        }
                        className="text-xs text-[#FB6F84] hover:text-rose-300 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-lg bg-[radial-gradient(#1e4e6e_1px,transparent_1px)] [background-size:8px_8px] bg-[#04111E]/80 border border-[#5EC8FF]/30 overflow-hidden flex items-center justify-center shrink-0">
                      {custom.cardFrontBgUrl || custom.cardBackBgUrl ? (
                        <img
                          src={custom.cardFrontBgUrl || custom.cardBackBgUrl}
                          alt="Card background"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#4DB8FF]/60" />
                      )}
                    </div>
                    <label className="flex-1 min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-bold text-slate-100 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap transition-colors">
                      <Upload className="w-4 h-4 shrink-0 text-[#4DB8FF]" />
                      <span>
                        {uploadingKey === 'cardFrontBgUrl'
                          ? 'Uploading...'
                          : 'Upload Card Background'}
                      </span>
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT_ATTR}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            handleUploadGlobalAsset(
                              'cardFrontBgUrl',
                              f,
                              { maxDim: 720, preserveTransparency: isAlphaCapableImage(f) },
                              'Card background'
                            );
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={globalCardBgUrlDraft}
                      onChange={(e) => setGlobalCardBgUrlDraft(e.target.value)}
                      placeholder="Or paste card background image URL..."
                      className="flex-1 min-h-[40px] px-2.5 py-1.5 rounded-lg glass-panel-deep text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4DB8FF]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = globalCardBgUrlDraft.trim();
                        applyCustomization(
                          { cardFrontBgUrl: trimmed, cardBackBgUrl: trimmed },
                          'Card background URL saved'
                        );
                      }}
                      className="min-h-[40px] px-3 rounded-lg bg-[#4DB8FF] hover:bg-[#7DD3FC] text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Card Accent Color */}
                <div className="p-3 rounded-xl glass-panel-deep flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#4DB8FF] shrink-0" />
                    <span className="text-xs font-bold text-white">
                      Selected Card Accent & Glow
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_SWATCHES.map((swatch) => {
                      const isPicked =
                        activeAccent.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          title={swatch.label}
                          onClick={() =>
                            applyCustomization(
                              { cardAccentColor: swatch.hex },
                              `Card accent set to ${swatch.label}`
                            )
                          }
                          className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-transform ${
                            isPicked ? 'border-white scale-105' : 'border-[#5EC8FF]/30'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        >
                          {isPicked && <Check className="w-4 h-4 text-slate-950 stroke-[3]" />}
                        </button>
                      );
                    })}
                    <label className="min-h-[36px] px-2.5 py-1 rounded-lg glass-panel-deep flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                      <input
                        type="color"
                        value={activeAccent}
                        onChange={(e) =>
                          applyCustomization(
                            { cardAccentColor: e.target.value },
                            'Custom card accent applied'
                          )
                        }
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="font-['JetBrains_Mono']">{activeAccent}</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* 8 Mini-Game Category Icons & Scale */}
              <section className="glass-panel glass-noise rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold font-['Unbounded'] text-white">
                      8 Game Icon Cards — Icons & Scale
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Shown directly on the 2×4 board cards, Host selector tiles, stingers, and mini-game headers. Supports PNG alpha transparency.
                    </p>
                  </div>
                  {((custom.miniGameIcons && Object.keys(custom.miniGameIcons).length > 0) ||
                    (custom.miniGameIconScales &&
                      Object.keys(custom.miniGameIconScales).length > 0) ||
                    (typeof custom.miniGameIconScale === 'number' &&
                      custom.miniGameIconScale !== 1)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const clearPatch: Partial<Record<MiniGameCategory, string>> = {};
                        const clearScales: Partial<Record<MiniGameCategory, number>> = {};
                        MINI_GAME_CATEGORIES.forEach((m) => {
                          clearPatch[m.category] = '';
                          clearScales[m.category] = 0;
                        });
                        setGlobalMiniGameScaleDraft(1);
                        applyCustomization(
                          {
                            miniGameIcons: clearPatch,
                            miniGameIconScales: clearScales,
                            miniGameIconScale: 1,
                          },
                          'All game icons and scales restored to defaults'
                        );
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl glass-panel-deep hover:bg-[#FB6F84]/20 hover:border-[#FB6F84]/60 text-xs font-bold text-slate-200 hover:text-rose-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span>Reset All Icons</span>
                    </button>
                  )}
                </div>

              {/* Global Mini-Game Icon Scale */}
              <div className="p-3 rounded-xl glass-panel-deep space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-[#4DB8FF] shrink-0" />
                    <span className="text-xs font-bold text-white">
                      Global Mini-Game Icon Scale
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#4DB8FF] tabular-nums">
                      {Math.round(globalMiniGameScaleDraft * 100)}%
                    </span>
                    {globalMiniGameScaleDraft !== 1 && (
                      <button
                        type="button"
                        onClick={() => handleGlobalMiniGameScaleChange(1, true)}
                        className="text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={globalMiniGameScaleDraft}
                    onChange={(e) =>
                      handleGlobalMiniGameScaleChange(Number(e.target.value))
                    }
                    aria-label="Global Mini-Game Icon Scale"
                    className="flex-1 min-w-[160px] accent-[#4DB8FF] cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {SCALE_PRESETS.map((preset) => {
                      const isActivePreset =
                        Math.abs(globalMiniGameScaleDraft - preset) < 0.02;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleGlobalMiniGameScaleChange(preset, true)}
                          className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-['JetBrains_Mono'] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                            isActivePreset
                              ? 'bg-[#4DB8FF] text-slate-950 border-[#7DD3FC]'
                              : 'glass-panel-deep text-slate-300 hover:border-[#4DB8FF]/60'
                          }`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MINI_GAME_CATEGORIES.map((item) => {
                  const customIconUrl = resolveCustomMiniGameIcon(custom, item.category);
                  const urlDraft = miniGameIconUrlDrafts[item.category] ?? '';
                  const isUrlOpen = Boolean(miniGameUrlOpen[item.category]);
                  const itemScale =
                    miniGameScaleDrafts[item.category] ?? globalMiniGameScaleDraft;
                  const hasPerItemScale = Boolean(
                    typeof custom.miniGameIconScales?.[item.category] === 'number' &&
                      (custom.miniGameIconScales?.[item.category] ?? 0) > 0
                  );

                  return (
                    <div
                      key={item.category}
                      className="p-3.5 rounded-xl glass-panel-deep space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold font-['Unbounded'] text-white truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] font-['JetBrains_Mono'] text-[#7DD3FC]">
                            {item.shortTitle}
                          </div>
                        </div>

                        {customIconUrl && (
                          <button
                            type="button"
                            onClick={() => applyMiniGameIcon(item.category, '', item.title)}
                            className="text-xs font-semibold text-[#FB6F84] hover:text-rose-300 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Reset Icon
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl bg-[radial-gradient(#1e4e6e_1px,transparent_1px)] [background-size:8px_8px] bg-[#04111E]/80 border border-[#5EC8FF]/30 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                          <CategoryBadgeArtwork
                            category={item.category}
                            customIconUrl={customIconUrl}
                            scale={itemScale}
                            className="w-12 h-12"
                          />
                        </div>

                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <label className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
                            <Upload className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {uploadingKey === `minigame-icon-${item.category}`
                                ? 'Uploading...'
                                : 'Upload Icon'}
                            </span>
                            <input
                              type="file"
                              accept={IMAGE_ACCEPT_ATTR}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadMiniGameIcon(item.category, item.title, f);
                                e.target.value = '';
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              setMiniGameUrlOpen((prev) => ({
                                ...prev,
                                [item.category]: !prev[item.category],
                              }))
                            }
                            className="min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            URL
                          </button>
                        </div>
                      </div>

                      {/* Per-Category Icon Scale */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#4DB8FF]/15">
                        <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap shrink-0">
                          Icon Scale
                        </span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.8}
                          step={0.05}
                          value={itemScale}
                          onChange={(e) =>
                            handleMiniGameScaleChange(
                              item.category,
                              item.title,
                              Number(e.target.value)
                            )
                          }
                          aria-label={`${item.title} icon scale`}
                          className="flex-1 min-w-0 accent-[#4DB8FF] cursor-pointer"
                        />
                        <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-[#4DB8FF] tabular-nums w-9 text-right shrink-0">
                          {Math.round(itemScale * 100)}%
                        </span>
                        {hasPerItemScale && (
                          <button
                            type="button"
                            onClick={() =>
                              handleMiniGameScaleChange(
                                item.category,
                                item.title,
                                undefined,
                                true
                              )
                            }
                            className="text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer shrink-0"
                          >
                            Global
                          </button>
                        )}
                      </div>

                      {isUrlOpen && (
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={urlDraft}
                            onChange={(e) =>
                              setMiniGameIconUrlDrafts((prev) => ({
                                ...prev,
                                [item.category]: e.target.value,
                              }))
                            }
                            placeholder="https://... custom mini-game icon URL"
                            className="flex-1 min-h-[40px] px-2.5 py-1.5 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              applyMiniGameIcon(item.category, urlDraft.trim(), item.title)
                            }
                            className="min-h-[40px] px-3 rounded-lg bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          )}

          {/* TAB 2: SHOW TITLE & STAGE */}
          {activeTab === 'stage' && (
            <div className="space-y-5">
              {/* Show Title Text */}
              <section className="glass-panel glass-noise rounded-2xl p-4 space-y-4">
                <div>
                  <h2 className="text-base font-bold font-['Unbounded'] text-white">
                    Show Title Typography (Home Screen & Scoreboard Header)
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Controls the title lockup shown on the empty Home Screen and top Studio bar.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Show Eyebrow
                    </label>
                    <input
                      type="text"
                      value={eyebrowDraft}
                      onChange={(e) => setEyebrowDraft(e.target.value)}
                      placeholder="STUDIO BROADCAST SHOW"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Primary Title (Cyan)
                    </label>
                    <input
                      type="text"
                      value={primaryTitleDraft}
                      onChange={(e) => setPrimaryTitleDraft(e.target.value)}
                      placeholder="FANZONE"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Secondary Title (White)
                    </label>
                    <input
                      type="text"
                      value={secondaryTitleDraft}
                      onChange={(e) => setSecondaryTitleDraft(e.target.value)}
                      placeholder="LIVE"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      applyCustomization(
                        {
                          showEyebrow: eyebrowDraft.trim(),
                          showTitlePrimary: primaryTitleDraft.trim(),
                          showTitleSecondary: secondaryTitleDraft.trim(),
                        },
                        'Show titles updated on Studio Monitor'
                      )
                    }
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Save Show Titles
                  </button>
                </div>
              </section>

              {/* Show Title Graphic / Logo */}
              <section className="glass-panel glass-noise rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold font-['Unbounded'] text-white">
                      Custom Show Title Graphic / Logo
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Replaces the default broadcast shield on the Home Screen and displays in the top bar.
                    </p>
                  </div>
                  {custom.showLogoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization({ showLogoUrl: '' }, 'Custom show logo removed')
                      }
                      className="min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs font-semibold text-[#FB6F84] hover:text-rose-300 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-[radial-gradient(#1e4e6e_1px,transparent_1px)] [background-size:8px_8px] bg-[#04111E]/80 border border-[#5EC8FF]/30 flex items-center justify-center overflow-hidden p-2 shrink-0">
                    {custom.showLogoUrl ? (
                      <img
                        src={custom.showLogoUrl}
                        alt="Show logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-[#4DB8FF]/50" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <label className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>
                        {uploadingKey === 'showLogoUrl'
                          ? 'Uploading Show PNG Logo...'
                          : 'Upload Show Logo PNG (Alpha Supported)'}
                      </span>
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT_ATTR}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            handleUploadGlobalAsset(
                              'showLogoUrl',
                              f,
                              { maxDim: 1280, preserveTransparency: true },
                              'Show PNG logo'
                            );
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={showLogoUrlDraft}
                        onChange={(e) => setShowLogoUrlDraft(e.target.value)}
                        placeholder="Or paste transparent PNG show logo URL..."
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          applyCustomization(
                            { showLogoUrl: showLogoUrlDraft.trim() },
                            'Show graphic URL applied'
                          )
                        }
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#4DB8FF] hover:bg-[#7DD3FC] text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Apply URL
                      </button>
                    </div>
                  </div>
                </div>

                {/* Show Logo Scale & Text Lockup Toggle */}
                <div className="p-3 rounded-xl glass-panel-deep space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Maximize2 className="w-3.5 h-3.5 text-[#4DB8FF] shrink-0" />
                      <span className="text-xs font-bold text-white">Show Logo Scale</span>
                      <span className="text-xs font-bold font-['Chakra_Petch'] tabular-nums text-[#7DD3FC]">
                        {Math.round(showLogoScaleDraft * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {SCALE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleShowLogoScaleChange(preset, true)}
                          className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-bold tabular-nums cursor-pointer whitespace-nowrap shrink-0 ${
                            Math.abs(showLogoScaleDraft - preset) < 0.03
                              ? 'bg-[#4DB8FF] text-slate-950'
                              : 'glass-panel-deep text-slate-300 hover:text-white'
                          }`}
                        >
                          {preset}×
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={showLogoScaleDraft}
                    onChange={(e) => handleShowLogoScaleChange(Number(e.target.value), false)}
                    className="w-full accent-[#4DB8FF] cursor-pointer"
                  />

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#5EC8FF]/15">
                    <span className="text-xs text-slate-300">
                      Hide title text below logo on Home Screen (use PNG logo alone)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentlyHidden = custom.hideShowTitleText !== false;
                        applyCustomization(
                          { hideShowTitleText: !currentlyHidden },
                          currentlyHidden
                            ? 'Show title text visible below logo'
                            : 'Home Screen set to PNG Logo Only'
                        );
                      }}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-colors ${
                        custom.hideShowTitleText !== false
                          ? 'bg-[#4DB8FF]/20 border-[#4DB8FF] text-[#7DD3FC]'
                          : 'border-[#5EC8FF]/25 text-slate-300 hover:text-white'
                      }`}
                    >
                      {custom.hideShowTitleText !== false ? (
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{custom.hideShowTitleText !== false ? 'PNG Logo Only' : 'Logo + Title Text'}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Studio Stage Background */}
              <section className="glass-panel glass-noise rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold font-['Unbounded'] text-white">
                      Studio Monitor Stage Background
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Full-screen backdrop behind the Home Screen, 2×4 Board, and Mini-Games (16:9 recommended).
                    </p>
                  </div>
                  {custom.stageBgUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization({ stageBgUrl: '' }, 'Studio stage background cleared')
                      }
                      className="min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs font-semibold text-[#FB6F84] hover:text-rose-300 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Remove Backdrop
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <div className="w-36 h-20 rounded-xl glass-panel-deep flex items-center justify-center overflow-hidden shrink-0">
                    {custom.stageBgUrl ? (
                      <img
                        src={custom.stageBgUrl}
                        alt="Studio stage backdrop"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-[#4DB8FF]/50" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <label className="w-full min-h-[44px] px-4 py-2 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-bold text-slate-100 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap transition-colors">
                      <Upload className="w-4 h-4 shrink-0 text-[#4DB8FF]" />
                      <span>
                        {uploadingKey === 'stageBgUrl'
                          ? 'Uploading Stage Backdrop...'
                          : 'Upload 16:9 Stage Background Image'}
                      </span>
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT_ATTR}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            handleUploadGlobalAsset(
                              'stageBgUrl',
                              f,
                              { maxDim: 1280, preserveTransparency: isAlphaCapableImage(f) },
                              'Studio stage background'
                            );
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={stageBgUrlDraft}
                        onChange={(e) => setStageBgUrlDraft(e.target.value)}
                        placeholder="Or paste background image URL..."
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          applyCustomization(
                            { stageBgUrl: stageBgUrlDraft.trim() },
                            'Studio backdrop URL applied'
                          )
                        }
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#4DB8FF] hover:bg-[#7DD3FC] text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Apply URL
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: TEAMS & LOGOS */}
          {activeTab === 'teams' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Team (Red) */}
              <section className="glass-panel glass-noise rounded-2xl border-[#FB6F84]/45 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold font-['Unbounded'] text-[#FB6F84]">
                    Left Scoreboard Team (Red)
                  </h2>
                  {custom.redTeamLogoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization({ redTeamLogoUrl: '' }, 'Left team logo cleared')
                      }
                      className="text-xs font-semibold text-[#FB6F84] hover:text-rose-300 cursor-pointer"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Team Name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={redNameDraft}
                      onChange={(e) => setRedNameDraft(e.target.value)}
                      placeholder="RED TEAM"
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs font-bold text-white focus:outline-none focus:border-[#FB6F84]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization(
                          { redTeamName: redNameDraft.trim() || 'RED TEAM' },
                          'Left team name updated'
                        )
                      }
                      className="min-h-[44px] px-4 rounded-xl bg-[#FB6F84] hover:bg-rose-400 text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-[radial-gradient(#1e4e6e_1px,transparent_1px)] [background-size:8px_8px] bg-[#04111E]/80 border border-[#5EC8FF]/30 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                    {custom.redTeamLogoUrl ? (
                      <img
                        src={custom.redTeamLogoUrl}
                        alt="Left team logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#FB6F84]/50" />
                    )}
                  </div>
                  <label className="flex-1 min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep hover:border-[#FB6F84]/60 text-xs font-bold text-slate-100 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
                    <Upload className="w-4 h-4 shrink-0 text-[#FB6F84]" />
                    <span>
                      {uploadingKey === 'redTeamLogoUrl' ? 'Uploading...' : 'Upload Team Logo'}
                    </span>
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT_ATTR}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleUploadGlobalAsset(
                            'redTeamLogoUrl',
                            f,
                            { maxDim: 320, preserveTransparency: true },
                            'Left team logo'
                          );
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={redLogoUrlDraft}
                    onChange={(e) => setRedLogoUrlDraft(e.target.value)}
                    placeholder="Or paste team logo URL..."
                    className="flex-1 min-h-[40px] px-2.5 py-1.5 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#FB6F84]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyCustomization(
                        { redTeamLogoUrl: redLogoUrlDraft.trim() },
                        'Left team logo URL saved'
                      )
                    }
                    className="min-h-[40px] px-3 rounded-lg bg-[#FB6F84] hover:bg-rose-400 text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </section>

              {/* Right Team (Blue) */}
              <section className="glass-panel glass-noise rounded-2xl border-[#4DB8FF]/45 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold font-['Unbounded'] text-[#4DB8FF]">
                    Right Scoreboard Team (Blue)
                  </h2>
                  {custom.blueTeamLogoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization({ blueTeamLogoUrl: '' }, 'Right team logo cleared')
                      }
                      className="text-xs font-semibold text-[#FB6F84] hover:text-rose-300 cursor-pointer"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Team Name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={blueNameDraft}
                      onChange={(e) => setBlueNameDraft(e.target.value)}
                      placeholder="BLUE TEAM"
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs font-bold text-white focus:outline-none focus:border-[#4DB8FF]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        applyCustomization(
                          { blueTeamName: blueNameDraft.trim() || 'BLUE TEAM' },
                          'Right team name updated'
                        )
                      }
                      className="min-h-[44px] px-4 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-[radial-gradient(#1e4e6e_1px,transparent_1px)] [background-size:8px_8px] bg-[#04111E]/80 border border-[#5EC8FF]/30 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                    {custom.blueTeamLogoUrl ? (
                      <img
                        src={custom.blueTeamLogoUrl}
                        alt="Right team logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#4DB8FF]/50" />
                    )}
                  </div>
                  <label className="flex-1 min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-bold text-slate-100 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
                    <Upload className="w-4 h-4 shrink-0 text-[#4DB8FF]" />
                    <span>
                      {uploadingKey === 'blueTeamLogoUrl' ? 'Uploading...' : 'Upload Team Logo'}
                    </span>
                    <input
                      type="file"
                      accept={IMAGE_ACCEPT_ATTR}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleUploadGlobalAsset(
                            'blueTeamLogoUrl',
                            f,
                            { maxDim: 320, preserveTransparency: true },
                            'Right team logo'
                          );
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={blueLogoUrlDraft}
                    onChange={(e) => setBlueLogoUrlDraft(e.target.value)}
                    placeholder="Or paste team logo URL..."
                    className="flex-1 min-h-[40px] px-2.5 py-1.5 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applyCustomization(
                        { blueTeamLogoUrl: blueLogoUrlDraft.trim() },
                        'Right team logo URL saved'
                      )
                    }
                    className="min-h-[40px] px-3 rounded-lg bg-[#4DB8FF] hover:bg-[#7DD3FC] text-xs font-extrabold text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export const CustomizePage: React.FC = () => {
  return (
    <GameSyncProvider role="host">
      <OwnerAuthGate
        title="FanZone Studio Customizer"
        subtitle="Customize Studio Monitor Game Icons, Cards, Show Title & Team Graphics"
      >
        <CustomizeBody />
      </OwnerAuthGate>
    </GameSyncProvider>
  );
};
