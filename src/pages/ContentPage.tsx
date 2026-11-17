import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Upload,
  Trash2,
  Edit3,
  Check,
  X,
  Volume2,
  Image as ImageIcon,
} from 'lucide-react';
import { GameSyncProvider, useGameSync } from '../context/GameSyncContext';
import { OwnerAuthGate } from '../components/OwnerAuthGate';
import { OceanicBackdrop } from '../components/OceanicBackdrop';
import {
  CONTENT_CATEGORIES,
  ContentCategory,
  ContentItem,
  resolveCustomMiniGameIcon,
} from '../types/game';
import { CategoryBadgeArtwork } from '../components/BroadcastArtwork';

const ContentManagerBody: React.FC = () => {
  const {
    state,
    contentItems,
    ownerAuth,
    logoutOwner,
    createContentItem,
    updateContentItem,
    deleteContentItem,
  } = useGameSync();

  const [activeTab, setActiveTab] = useState<ContentCategory>('jersey');

  // Create Form State
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState<number>(0);
  const [mediaUrl, setMediaUrl] = useState('');
  const [blurAmount, setBlurAmount] = useState<number>(28);
  const [previewBlurred, setPreviewBlurred] = useState<boolean>(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit Item State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrectIndex, setEditCorrectIndex] = useState<number>(0);
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [editBlurAmount, setEditBlurAmount] = useState<number>(28);
  const [editPreviewBlurred, setEditPreviewBlurred] = useState<boolean>(true);

  // Delete Confirmation State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const currentTabConfig =
    CONTENT_CATEGORIES.find((c) => c.id === activeTab) || CONTENT_CATEGORIES[0];
  const isMultipleChoiceTab = activeTab === 'multiple_choice' || (activeTab as string) === 'number';
  const filteredItems = contentItems.filter(
    (item) => item.category === activeTab || (isMultipleChoiceTab && (item.category as string) === 'number')
  );

  // Fallback to FileReader DataURL if serverless upload endpoint is unavailable on Vercel
  const fallbackReadFileAsDataUrl = (file: File, isEdit: boolean) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (isEdit) {
          setEditMediaUrl(reader.result);
        } else {
          setMediaUrl(reader.result);
        }
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 900);
      } else {
        setUploadError('Unable to read media file');
        setUploadProgress(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Unable to read media file');
      setUploadProgress(null);
    };
    reader.readAsDataURL(file);
  };

  // Upload media file with real-time progress bar
  const handleFileUpload = (file: File, isEdit = false) => {
    if (!ownerAuth.token) return;
    setUploadError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/content/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${ownerAuth.token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.mediaUrl) {
            if (isEdit) {
              setEditMediaUrl(resp.mediaUrl);
            } else {
              setMediaUrl(resp.mediaUrl);
            }
            setUploadProgress(100);
            setTimeout(() => setUploadProgress(null), 900);
            return;
          }
        } catch {
          // Fall back to DataURL reader below
        }
      }
      fallbackReadFileAsDataUrl(file, isEdit);
    };

    xhr.onerror = () => {
      fallbackReadFileAsDataUrl(file, isEdit);
    };

    xhr.send(formData);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAnswer =
      answer.trim() ||
      (isMultipleChoiceTab ? (options[selectedCorrectIndex] || options[0] || '').trim() : '');
    if (!ownerAuth.token || !finalAnswer) return;
    setSaving(true);
    try {
      const cleanOptions = isMultipleChoiceTab
        ? options.map((o) => o.trim()).filter(Boolean)
        : undefined;
      await createContentItem({
        category: activeTab,
        title: title.trim() || prompt.trim() || `${currentTabConfig.label} Item`,
        prompt: prompt.trim() || title.trim() || `Identify this ${currentTabConfig.label} clue!`,
        answer: finalAnswer,
        options: cleanOptions && cleanOptions.length >= 2 ? cleanOptions : undefined,
        mediaUrl: mediaUrl.trim() || undefined,
        blurAmount: currentTabConfig.mediaType === 'image' ? blurAmount : undefined,
      });
      setTitle('');
      setPrompt('');
      setAnswer('');
      setOptions(['', '', '', '']);
      setSelectedCorrectIndex(0);
      setMediaUrl('');
      setBlurAmount(28);
      setPreviewBlurred(true);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (item: ContentItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditPrompt(item.prompt);
    setEditAnswer(item.answer);
    const opts =
      item.options && item.options.length >= 2
        ? [...item.options]
        : [item.answer || '', '', '', ''];
    while (opts.length < 4) opts.push('');
    setEditOptions(opts);
    const foundIdx = opts.findIndex(
      (o) => o.trim().toLowerCase() === (item.answer || '').trim().toLowerCase()
    );
    setEditCorrectIndex(foundIdx >= 0 ? foundIdx : 0);
    setEditMediaUrl(item.mediaUrl || '');
    setEditBlurAmount(typeof item.blurAmount === 'number' ? item.blurAmount : 28);
    setEditPreviewBlurred(true);
  };

  const handleSaveEdit = async (id: string) => {
    if (!ownerAuth.token) return;
    const finalAnswer =
      editAnswer.trim() ||
      (isMultipleChoiceTab ? (editOptions[editCorrectIndex] || editOptions[0] || '').trim() : '');
    const cleanOptions = isMultipleChoiceTab
      ? editOptions.map((o) => o.trim()).filter(Boolean)
      : undefined;
    await updateContentItem(id, {
      title: editTitle.trim(),
      prompt: editPrompt.trim(),
      answer: finalAnswer,
      options: cleanOptions && cleanOptions.length >= 2 ? cleanOptions : undefined,
      mediaUrl: editMediaUrl.trim() || undefined,
      blurAmount: currentTabConfig.mediaType === 'image' ? editBlurAmount : undefined,
    });
    setEditingId(null);
  };

  const handleDeleteItem = async (id: string) => {
    if (!ownerAuth.token) return;
    await deleteContentItem(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="relative min-h-screen bg-[#040F1A] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans']">
      <OceanicBackdrop fixed />

      {/* Top Bar Contract: 3 Zones Separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3 glass-header">
        <Link
          to="/content"
          className="text-lg font-extrabold font-['Unbounded'] tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <span className="text-[#4DB8FF]">FanZone</span> Content Manager
        </Link>

        <nav className="flex items-center gap-6 text-sm font-semibold text-slate-300 font-['Chakra_Petch']">
          <Link
            to="/host"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Host Console
          </Link>
          <Link
            to="/content"
            className="text-[#4DB8FF] hover:text-[#7DD3FC] transition-colors whitespace-nowrap shrink-0"
          >
            Content Manager
          </Link>
          <Link
            to="/customize"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
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

      <main className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto p-6 space-y-6">
        {/* 7 Content Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-2 glass-panel glass-noise rounded-2xl">
          {CONTENT_CATEGORIES.map((cat) => {
            const count = contentItems.filter((i) => i.category === cat.id).length;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveTab(cat.id);
                  setEditingId(null);
                  setConfirmDeleteId(null);
                  setUploadError(null);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#4DB8FF] text-slate-950 shadow-[0_0_20px_rgba(77,184,255,0.28)]'
                    : 'text-slate-300 hover:text-white hover:bg-[#0D3350]/55'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`font-['JetBrains_Mono'] tabular-nums text-[11px] ${
                    isActive ? 'text-slate-900' : 'text-[#7DD3FC]/75'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Add New Content Item Form */}
          <section className="lg:col-span-5 glass-panel glass-noise rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CategoryBadgeArtwork
                category={activeTab}
                customIconUrl={resolveCustomMiniGameIcon(state?.customization, activeTab)}
                className="w-12 h-12 shrink-0"
              />
              <div>
                <h2 className="text-lg font-bold font-['Unbounded'] text-white">
                  Add New {currentTabConfig.label} Item
                </h2>
                <p className="text-xs text-slate-300">{currentTabConfig.description}</p>
              </div>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              {currentTabConfig.mediaType !== 'none' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    {currentTabConfig.mediaType === 'image'
                      ? 'Upload Image File (PNG/JPG/WEBP)'
                      : 'Upload Audio Clip (MP3/WAV/OGG/M4A)'}
                  </label>

                  <label className="min-h-[48px] px-4 py-3 rounded-xl glass-panel-deep border-dashed border-[#4DB8FF]/40 hover:border-[#4DB8FF] text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-[#4DB8FF]" />
                    <span>
                      Choose {currentTabConfig.mediaType === 'image' ? 'Image' : 'Audio'} File to
                      Upload
                    </span>
                    <input
                      type="file"
                      accept={
                        currentTabConfig.mediaType === 'image'
                          ? 'image/*'
                          : 'audio/*,.mp3,.wav,.ogg,.m4a'
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, false);
                      }}
                      className="hidden"
                    />
                  </label>

                  {/* Upload Progress Bar */}
                  {uploadProgress !== null && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[11px] font-['JetBrains_Mono'] text-[#4DB8FF]">
                        <span>Uploading Media...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#04111E]/90 overflow-hidden">
                        <div
                          className="h-full bg-[#4DB8FF] transition-all duration-150"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <p className="mt-1.5 text-xs text-[#FB6F84]">{uploadError}</p>
                  )}

                  <div className="mt-2">
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder={
                        currentTabConfig.mediaType === 'image'
                          ? 'Or paste /samples/... image path'
                          : 'Or paste /samples/... audio path'
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl glass-panel-deep text-xs text-slate-200 focus:outline-none focus:border-[#4DB8FF]"
                    />
                  </div>

                  {/* Mystery Blur Control & Live Preview for All Image Guess Games */}
                  {currentTabConfig.mediaType === 'image' && (
                    <div className="mt-3 p-3.5 rounded-xl glass-panel-deep space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold text-[#4DB8FF]">
                            Mystery Blur Control (Studio Starting Blur)
                          </label>
                          <p className="text-[11px] text-slate-300">
                            Adjust how blurred this photo appears on /studio before reveal
                          </p>
                        </div>
                        <span className="font-['JetBrains_Mono'] font-bold text-xs px-2.5 py-1 rounded-lg bg-[#4DB8FF]/15 border border-[#4DB8FF]/40 text-[#7DD3FC] tabular-nums">
                          {blurAmount}px
                        </span>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={2}
                        value={blurAmount}
                        onChange={(e) => setBlurAmount(Number(e.target.value))}
                        className="w-full accent-[#4DB8FF] cursor-pointer"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        {[
                          { label: 'Clear (0px)', val: 0 },
                          { label: 'Light (12px)', val: 12 },
                          { label: 'Medium (20px)', val: 20 },
                          { label: 'Default (28px)', val: 28 },
                          { label: 'Heavy (40px)', val: 40 },
                          { label: 'Extreme (52px)', val: 52 },
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setBlurAmount(preset.val)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                              blurAmount === preset.val
                                ? 'bg-[#4DB8FF] text-slate-950 font-extrabold'
                                : 'glass-panel-deep text-slate-300 hover:border-[#4DB8FF]/60'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">
                            {mediaUrl
                              ? 'Live Broadcast Blur Preview (Uploaded Photo):'
                              : 'Live Broadcast Blur Preview (Sample Reference):'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewBlurred((prev) => !prev)}
                            className="px-2.5 py-1 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-[11px] font-semibold text-[#7DD3FC] cursor-pointer"
                          >
                            {previewBlurred
                              ? `Showing Blurred (${blurAmount}px) · Tap to Test Reveal`
                              : 'Showing Revealed (0px) · Tap to Test Blur'}
                          </button>
                        </div>
                        <div className="relative p-3 rounded-xl glass-panel-deep flex items-center justify-center h-44 overflow-hidden">
                          <img
                            src={
                              mediaUrl ||
                              (activeTab === 'jersey'
                                ? '/samples/sample_jersey_kit.jpg'
                                : activeTab === 'photo'
                                ? '/samples/sample_player_action.jpg'
                                : activeTab === 'stadium'
                                ? '/samples/sample_stadium_night.jpg'
                                : '/samples/sample_club_crest.jpg')
                            }
                            alt="Upload preview"
                            referrerPolicy="no-referrer"
                            style={{
                              filter: `blur(${previewBlurred ? blurAmount : 0}px)`,
                            }}
                            className="max-h-full max-w-full object-contain rounded-lg transition-all duration-300"
                          />
                          <span className="pointer-events-none absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#04111E]/85 border border-[#4DB8FF]/40 text-[10px] font-['JetBrains_Mono'] text-[#7DD3FC]">
                            {previewBlurred ? `BLUR ${blurAmount}px` : 'UNBLURRED 0px'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {mediaUrl && currentTabConfig.mediaType === 'audio' && (
                    <div className="mt-2 p-2 rounded-xl glass-panel-deep">
                      <audio controls src={mediaUrl} className="w-full h-10" />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Item Title / Short Label
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isMultipleChoiceTab
                      ? 'e.g., Messi 2012 Calendar Goals'
                      : 'e.g., 2011/12 Championship Home Kit'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl glass-panel-deep text-sm text-white focus:outline-none focus:border-[#4DB8FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  {activeTab === 'quiz' || isMultipleChoiceTab
                    ? 'Question Text (Displayed on Studio Screen)'
                    : 'Clue / Question Prompt'}
                </label>
                <textarea
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    isMultipleChoiceTab
                      ? 'Enter multiple choice question shown on Studio display...'
                      : 'Enter the question or clue shown to contestants...'
                  }
                  className="w-full px-3.5 py-2 rounded-xl glass-panel-deep text-sm text-white focus:outline-none focus:border-[#4DB8FF]"
                />
              </div>

              {isMultipleChoiceTab && (
                <div className="p-3.5 rounded-xl glass-panel-deep space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4DB8FF]">
                      4 Multiple Choice Options (A, B, C, D)
                    </span>
                    <span className="text-[11px] text-[#34D399] font-semibold">
                      Click letter to mark correct
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {['A', 'B', 'C', 'D'].map((letter, idx) => {
                      const isCorrect = selectedCorrectIndex === idx;
                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                            isCorrect
                              ? 'bg-[#064E3B]/55 border-[#34D399] text-white ring-1 ring-[#34D399]/40'
                              : 'glass-panel-deep text-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            title={`Mark option ${letter} as the correct answer`}
                            onClick={() => {
                              setSelectedCorrectIndex(idx);
                              if (options[idx]) setAnswer(options[idx]);
                            }}
                            className={`w-7 h-7 rounded-lg font-['Chakra_Petch'] font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                              isCorrect
                                ? 'bg-[#34D399] text-slate-950 shadow-sm'
                                : 'bg-[#0C3554] text-slate-200 hover:bg-[#4DB8FF] hover:text-slate-950'
                            }`}
                          >
                            {letter}
                          </button>
                          <input
                            type="text"
                            value={options[idx]}
                            placeholder={`Option ${letter} text...`}
                            onChange={(e) => {
                              const updated = [...options];
                              updated[idx] = e.target.value;
                              setOptions(updated);
                              if (isCorrect) {
                                setAnswer(e.target.value);
                              }
                            }}
                            className="flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#34D399] mb-1">
                  Official Answer (Private to Host until Revealed) *
                </label>
                <input
                  type="text"
                  required
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    isMultipleChoiceTab
                      ? 'Selected option text (e.g., 91 Goals)'
                      : 'Enter the official answer...'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl glass-panel-deep border-[#34D399]/50 text-sm text-[#34D399] font-semibold focus:outline-none focus:border-[#34D399]"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-[0_0_24px_rgba(77,184,255,0.28)]"
              >
                <Plus className="w-4 h-4" />
                <span>{saving ? 'Saving Item...' : `Save to ${currentTabConfig.label}`}</span>
              </button>
            </form>
          </section>

          {/* RIGHT: Saved Category Items List with Edit, Delete & Preview */}
          <section className="lg:col-span-7 glass-panel glass-noise rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-['Unbounded'] text-white">
                  Saved {currentTabConfig.label} Bank ({filteredItems.length})
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Snapshot Isolation Active: Editing or deleting items here never breaks an active
                  live round
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id;
                const isConfirmingDelete = confirmDeleteId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl glass-panel-deep flex flex-col gap-3"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-300 mb-1">Title</label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full min-h-[44px] px-3 py-2 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#34D399] mb-1">
                              Official Answer
                            </label>
                            <input
                              type="text"
                              value={editAnswer}
                              onChange={(e) => setEditAnswer(e.target.value)}
                              className="w-full min-h-[44px] px-3 py-2 rounded-lg glass-panel-deep border-[#34D399]/50 text-xs text-[#34D399] font-bold focus:outline-none focus:border-[#34D399]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-300 mb-1">
                            Prompt / Question Text
                          </label>
                          <input
                            type="text"
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            className="w-full min-h-[44px] px-3 py-2 rounded-lg glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                          />
                        </div>

                        {isMultipleChoiceTab && (
                          <div className="p-3 rounded-xl glass-panel-deep space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#4DB8FF]">
                                Multiple Choice Options (A, B, C, D)
                              </span>
                              <span className="text-[11px] text-[#34D399] font-semibold">
                                Click letter to mark correct
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {['A', 'B', 'C', 'D'].map((letter, idx) => {
                                const isCorrect = editCorrectIndex === idx;
                                return (
                                  <div
                                    key={letter}
                                    className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                                      isCorrect
                                        ? 'bg-[#064E3B]/55 border-[#34D399] text-white ring-1 ring-[#34D399]/40'
                                        : 'glass-panel-deep text-slate-200'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      title={`Mark option ${letter} as correct`}
                                      onClick={() => {
                                        setEditCorrectIndex(idx);
                                        if (editOptions[idx]) setEditAnswer(editOptions[idx]);
                                      }}
                                      className={`w-7 h-7 rounded font-['Chakra_Petch'] font-black text-xs flex items-center justify-center shrink-0 cursor-pointer ${
                                        isCorrect
                                          ? 'bg-[#34D399] text-slate-950 shadow-sm'
                                          : 'bg-[#0C3554] text-slate-200 hover:bg-[#4DB8FF] hover:text-slate-950'
                                      }`}
                                    >
                                      {letter}
                                    </button>
                                    <input
                                      type="text"
                                      value={editOptions[idx]}
                                      placeholder={`Option ${letter}`}
                                      onChange={(e) => {
                                        const updated = [...editOptions];
                                        updated[idx] = e.target.value;
                                        setEditOptions(updated);
                                        if (isCorrect) {
                                          setEditAnswer(e.target.value);
                                        }
                                      }}
                                      className="flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {currentTabConfig.mediaType !== 'none' && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editMediaUrl}
                                onChange={(e) => setEditMediaUrl(e.target.value)}
                                placeholder="Media URL"
                                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg glass-panel-deep text-xs text-slate-200 focus:outline-none focus:border-[#4DB8FF]"
                              />
                              <label className="min-h-[44px] px-3 py-2 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-semibold text-[#7DD3FC] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Replace File</span>
                                <input
                                  type="file"
                                  accept={
                                    currentTabConfig.mediaType === 'image'
                                      ? 'image/*'
                                      : 'audio/*,.mp3,.wav,.ogg,.m4a'
                                  }
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileUpload(f, true);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            {currentTabConfig.mediaType === 'image' && (
                              <div className="p-3 rounded-xl glass-panel-deep space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#4DB8FF]">
                                    Mystery Blur Intensity: {editBlurAmount}px
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditPreviewBlurred((p) => !p)}
                                    className="px-2.5 py-1 rounded glass-panel-deep hover:border-[#4DB8FF]/60 text-[11px] font-semibold text-[#7DD3FC] cursor-pointer"
                                  >
                                    {editPreviewBlurred ? 'Test Unblurred' : 'Test Blurred'}
                                  </button>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={60}
                                  step={2}
                                  value={editBlurAmount}
                                  onChange={(e) => setEditBlurAmount(Number(e.target.value))}
                                  className="w-full accent-[#4DB8FF] cursor-pointer"
                                />
                                {editMediaUrl && (
                                  <div className="relative h-32 rounded-lg glass-panel-deep flex items-center justify-center overflow-hidden p-2">
                                    <img
                                      src={editMediaUrl}
                                      alt="Edit blur preview"
                                      referrerPolicy="no-referrer"
                                      style={{
                                        filter: `blur(${editPreviewBlurred ? editBlurAmount : 0}px)`,
                                      }}
                                      className="max-h-full max-w-full object-contain transition-all duration-300"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#34D399] hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[44px] px-4 py-2 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Instant Thumbnail or Audio Icon */}
                          {currentTabConfig.mediaType === 'image' && (
                            <div className="w-20 h-20 rounded-xl glass-panel-deep overflow-hidden flex items-center justify-center shrink-0">
                              {item.mediaUrl ? (
                                <img
                                  src={item.mediaUrl}
                                  alt={item.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <ImageIcon className="w-6 h-6 text-[#4DB8FF]/50" />
                              )}
                            </div>
                          )}

                          {currentTabConfig.mediaType === 'audio' && (
                            <div className="w-12 h-12 rounded-xl bg-[#4DB8FF]/15 border border-[#4DB8FF]/35 flex items-center justify-center text-[#4DB8FF] shrink-0">
                              <Volume2 className="w-6 h-6" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold font-['Unbounded'] text-white">
                              {item.title}
                            </h3>
                            <p className="text-xs text-slate-300 mt-0.5">{item.prompt}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <p className="text-xs font-bold text-[#34D399]">
                                Answer: {item.answer}
                              </p>
                              {currentTabConfig.mediaType === 'image' && (
                                <span className="text-[11px] font-['JetBrains_Mono'] font-semibold px-2 py-0.5 rounded bg-[#4DB8FF]/15 border border-[#4DB8FF]/35 text-[#7DD3FC]">
                                  Blur: {item.blurAmount ?? 28}px
                                </span>
                              )}
                            </div>

                            {item.options && item.options.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 max-w-xl">
                                {item.options.slice(0, 4).map((opt, i) => {
                                  const letter = ['A', 'B', 'C', 'D'][i];
                                  const isCorrect =
                                    opt.trim().toLowerCase() === (item.answer || '').trim().toLowerCase() ||
                                    (item.answer || '').trim().toUpperCase() === letter;
                                  return (
                                    <div
                                      key={i}
                                      className={`px-2 py-1 rounded-lg text-xs font-['Chakra_Petch'] flex items-center gap-1.5 border transition-all ${
                                        isCorrect
                                          ? 'bg-[#064E3B]/65 border-[#34D399] text-emerald-200 font-bold shadow-sm ring-1 ring-[#34D399]/30'
                                          : 'glass-panel-deep text-slate-300'
                                      }`}
                                    >
                                      <span
                                        className={`w-4 h-4 rounded text-[10px] font-black flex items-center justify-center shrink-0 ${
                                          isCorrect
                                            ? 'bg-[#34D399] text-slate-950'
                                            : 'bg-[#0C3554] text-slate-200'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <span className="truncate">{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {currentTabConfig.mediaType === 'image' && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 glass-panel-deep rounded-lg px-2.5 py-1.5 max-w-md">
                                <span className="text-[11px] font-semibold text-[#7DD3FC] whitespace-nowrap">
                                  Blur Control:
                                </span>
                                <input
                                  type="range"
                                  min={0}
                                  max={60}
                                  step={2}
                                  value={item.blurAmount ?? 28}
                                  onChange={(e) =>
                                    updateContentItem(item.id, {
                                      blurAmount: Number(e.target.value),
                                    })
                                  }
                                  className="flex-1 min-w-[100px] accent-[#4DB8FF] cursor-pointer"
                                />
                                <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-[#4DB8FF] tabular-nums w-9 text-right">
                                  {item.blurAmount ?? 28}px
                                </span>
                              </div>
                            )}

                            {currentTabConfig.mediaType === 'audio' && item.mediaUrl && (
                              <audio
                                controls
                                src={item.mediaUrl}
                                className="w-full max-w-md h-9 mt-2"
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#4DB8FF]" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-[#FB6F84]/15 hover:bg-[#FB6F84]/25 border border-[#FB6F84]/40 text-xs font-semibold text-rose-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Confirmation Step Before Deletion */}
                    {isConfirmingDelete && (
                      <div className="p-3 rounded-lg bg-[#3B1324]/85 backdrop-blur-md border border-[#FB6F84]/60 flex items-center justify-between gap-3">
                        <span className="text-xs text-rose-100 font-medium">
                          Delete “{item.title}” from the content bank?
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#FB6F84] hover:bg-rose-400 text-slate-950 text-xs font-extrabold cursor-pointer whitespace-nowrap"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[44px] px-3 py-1.5 rounded-lg glass-panel-deep text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export const ContentPage: React.FC = () => {
  return (
    <GameSyncProvider role="host">
      <OwnerAuthGate
        title="FanZone Content Manager"
        subtitle="Persistent Broadcast Media & Trivia Bank"
      >
        <ContentManagerBody />
      </OwnerAuthGate>
    </GameSyncProvider>
  );
};
