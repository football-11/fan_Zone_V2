import React, { useEffect, useState, useRef } from 'react';
import { GameSyncProvider, useGameSync } from '../context/GameSyncContext';
import { StudioStageView } from '../components/StudioStageView';
import { StudioErrorBoundary } from '../components/StudioErrorBoundary';
import { OceanicBackdrop } from '../components/OceanicBackdrop';
import { ArrowLeft, Maximize, Minimize, RefreshCw, Radio, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';

const StudioScreenContent: React.FC = () => {
  const { state, connected, syncQuotaExceeded, forceSync } = useGameSync();
  const [showToolbar, setShowToolbar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingElapsed, setConnectingElapsed] = useState(0);
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceSync();
    } catch {
      window.location.reload();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Auto-track connecting wait duration
  useEffect(() => {
    if (state) return;
    const interval = setInterval(() => {
      setConnectingElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  // Track fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Mouse activity toolbar & cursor control
  const handleMouseMove = () => {
    setShowToolbar(true);
    if (toolbarTimeoutRef.current) {
      clearTimeout(toolbarTimeoutRef.current);
    }
    toolbarTimeoutRef.current = setTimeout(() => {
      setShowToolbar(false);
    }, 3200);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!state) {
    return (
      <div className="relative w-screen h-screen bg-[#021E26] text-white flex flex-col items-center justify-center p-6 select-none font-['Chakra_Petch'] overflow-hidden">
        <OceanicBackdrop />
        <div className="relative z-10 glass-panel glass-noise rounded-2xl p-8 max-w-lg w-full flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="w-18 h-18 rounded-2xl glass-panel-deep border border-[#4DB8FF]/60 flex items-center justify-center shadow-[0_0_36px_rgba(77,184,255,0.28)]">
              <Radio className="w-9 h-9 text-[#4DB8FF] animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#4DB8FF] animate-ping" />
          </div>

          <h1 className="text-xl lg:text-2xl font-extrabold font-['Unbounded'] tracking-wide text-white mb-2">
            <span className="text-[#4DB8FF]">FANZONE</span> LIVE · CONNECTING...
          </h1>
          <p className="text-sm text-slate-300 max-w-md text-center mb-6">
            {connectingElapsed > 2
              ? 'Waiting for broadcast host session. You can force sync or switch to the host console below.'
              : 'Synchronizing real-time 16:9 broadcast stage with host control console.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-5 py-2.5 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 font-extrabold text-xs tracking-wider flex items-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(77,184,255,0.3)] active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'SYNCING FEED...' : 'RETRY FEED'}</span>
            </button>
            <Link
              to="/host"
              className="px-5 py-2.5 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-slate-200 font-bold text-xs tracking-wider flex items-center gap-2 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>GO TO HOST CONSOLE</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeTeam = state.activeTeam;

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`relative w-screen h-screen bg-[#040E18] flex items-center justify-center p-0 sm:p-2 md:p-4 lg:p-6 overflow-hidden select-none font-['Chakra_Petch'] ${
        showToolbar ? 'cursor-default' : 'cursor-none'
      }`}
    >
      {/* Dynamic Ambient Stadium Floodlight Backdrop (Reacts to Active Team) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Red Team Coral Glow (Left Aura) */}
        <div
          className={`absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full blur-[140px] transition-all duration-700 pointer-events-none ${
            activeTeam === 'red' ? 'opacity-35 scale-105' : 'opacity-12 scale-95'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(244,63,94,0.48) 0%, transparent 70%)',
          }}
        />

        {/* Blue Team Cyan Glow (Right Aura) */}
        <div
          className={`absolute -top-[20%] -right-[10%] w-[55vw] h-[55vw] rounded-full blur-[140px] transition-all duration-700 pointer-events-none ${
            activeTeam === 'blue' ? 'opacity-40 scale-105' : 'opacity-18 scale-95'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(77,184,255,0.45) 0%, transparent 70%)',
          }}
        />

        {/* Center Teal Broadcast Halo */}
        <div
          className="absolute -bottom-[25%] left-[25%] w-[50vw] h-[45vw] rounded-full blur-[160px] opacity-25 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(16,94,132,0.45) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Top Floating Broadcast Toolbar (Hover-Revealed) */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 px-6 py-2.5 bg-gradient-to-b from-[#040E18]/95 via-[#071A2B]/85 to-transparent backdrop-blur-sm flex items-center justify-between transition-opacity duration-300 ${
          showToolbar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/host"
            className="px-3 py-1.5 rounded-lg bg-[#081A2C]/90 border border-[#38BDF8]/30 hover:border-[#4DB8FF] text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Host Console</span>
          </Link>
          <Link
            to="/content"
            className="px-3 py-1.5 rounded-lg bg-[#081A2C]/90 border border-[#38BDF8]/30 hover:border-[#4DB8FF] text-slate-300 hover:text-white font-bold text-xs transition-colors shadow-md"
          >
            Content Bank
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4DB8FF]/10 border border-[#4DB8FF]/30 text-[11px] font-bold text-[#7DD3FC] font-['JetBrains_Mono']">
            <Tv className="w-3 h-3 text-[#4DB8FF]" />
            <span>16:9 BROADCAST STAGE</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#081A2C]/90 border border-[#38BDF8]/30 text-xs font-['JetBrains_Mono'] shadow-md">
            <span
              className={`w-2 h-2 rounded-full ${
                syncQuotaExceeded
                  ? 'bg-rose-400'
                  : connected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-[#4DB8FF]'
              }`}
            />
            <span className="text-slate-300">
              {syncQuotaExceeded
                ? 'FIRESTORE QUOTA EXCEEDED'
                : connected
                ? 'BROADCAST SYNC LIVE'
                : 'AUTO-POLL SYNC ACTIVE'}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            title="Force sync studio feed"
            className="p-1.5 rounded-lg bg-[#081A2C]/90 border border-[#38BDF8]/30 hover:border-[#4DB8FF] text-slate-300 hover:text-white cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#4DB8FF]' : ''}`} />
          </button>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-1.5 rounded-lg bg-[#081A2C]/90 border border-[#38BDF8]/30 hover:border-[#4DB8FF] text-slate-300 hover:text-white cursor-pointer shadow-md"
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* STRICT 16:9 ASPECT RATIO BROADCAST STAGE CONTAINER */}
      <div
        className="relative w-full max-w-[1920px] max-h-full aspect-video flex flex-col justify-between overflow-hidden bg-[#061523] shadow-[0_0_100px_rgba(0,0,0,0.85)] border border-[#38BDF8]/25 rounded-none sm:rounded-2xl"
        style={{
          aspectRatio: '16 / 9',
        }}
      >
        <StudioStageView state={state} isPreview={false} />
      </div>
    </div>
  );
};

export const StudioPage: React.FC = () => {
  return (
    <StudioErrorBoundary>
      <GameSyncProvider role="studio">
        <StudioScreenContent />
      </GameSyncProvider>
    </StudioErrorBoundary>
  );
};
