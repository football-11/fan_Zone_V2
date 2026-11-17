import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  ActiveMiniGameState,
  GameSessionState,
  MiniGameCategory,
  resolveCustomMiniGameIcon,
  resolveMiniGameIconScale,
  resolveShowLogoScale,
} from '../types/game';
import {
  CategoryBadgeArtwork,
  ClubCrestArtwork,
} from './BroadcastArtwork';
import { OceanicBackdrop } from './OceanicBackdrop';
import { resolveBzzoiroPlayerImageUrl } from '../data/bzzoiroSports';

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.min(99, Math.floor(seconds)));
  const ss = String(clamped).padStart(2, '0');
  return `00:${ss}`;
}

/**
 * Highlights key words/phrases (numbers, proper nouns, quoted terms, and high-signal football nouns)
 * in broadcast cyan (#4DB8FF) to match the crisp two-tone broadcast typography.
 */
function renderBroadcastPrompt(prompt: string): React.ReactNode {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  // Support explicit *highlight* markers if provided in custom content
  if (trimmed.includes('*')) {
    const parts = trimmed.split(/(\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <span key={idx} className="text-[#4DB8FF]">
            {part.slice(1, -1)}
          </span>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  }

  const keyVerbsAndNouns = new Set([
    'official',
    'goals',
    'calendar',
    'hosted',
    'won',
    'fifa',
    'world',
    'cup',
    'champions',
    'league',
    'european',
    'anthem',
    'stadium',
    'fanfare',
    'superstar',
    'volley',
    'white',
    'gold',
    'metallic',
    'home',
    'strip',
    'jersey',
    'four-tier',
    'trophy',
    'record',
    'club',
    'captain',
    'final',
    'hat-trick',
    'transfer',
    'derby',
  ]);

  const tokens = trimmed.split(/(\s+)/);
  let highlightedCount = 0;

  return tokens.map((token, idx) => {
    if (/^\s+$/.test(token)) {
      return <React.Fragment key={idx}>{token}</React.Fragment>;
    }
    const clean = token.replace(/^[^a-zA-Z0-9#]+|[^a-zA-Z0-9]+$/g, '');
    const lower = clean.toLowerCase();
    const isFirstWord = idx === 0;
    const isNumberOrYear = /^#?\d+([-/–]\d+)?%?$/.test(clean);
    const isProperNoun = !isFirstWord && /^[A-Z][a-zA-Z0-9'-]+$/.test(clean) && clean.length >= 2;
    const isKeyword = keyVerbsAndNouns.has(lower);

    const shouldHighlight =
      (isNumberOrYear || isProperNoun || isKeyword) && highlightedCount < 8;

    if (shouldHighlight) {
      highlightedCount += 1;
      return (
        <span key={idx} className="text-[#4DB8FF]">
          {token}
        </span>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export const StudioStageView: React.FC<{
  state: GameSessionState;
  isPreview?: boolean;
}> = ({ state, isPreview = false }) => {
  const [pulseTeam, setPulseTeam] = useState<'red' | 'blue' | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Broadcast Open / Close Mini-Game Transition State
  const [renderedMiniGame, setRenderedMiniGame] = useState<ActiveMiniGameState | null>(
    state.stage === 'minigame' && state.activeMiniGame ? state.activeMiniGame : null
  );
  const [stageAnim, setStageAnim] = useState<'idle' | 'opening' | 'closing' | 'board-enter'>('idle');
  const [isDealingBoard, setIsDealingBoard] = useState(false);
  const [stingerInfo, setStingerInfo] = useState<{
    mode: 'open' | 'close' | 'reveal';
    title: string;
    subtitle: string;
    category?: MiniGameCategory;
    key: number;
  } | null>(null);

  const prevStageRef = useRef<'home' | 'board' | 'minigame'>(state.stage);
  const prevDeckIdRef = useRef<number>(state.boardDeckId || 1);

  // Synchronize open, close, home, and reveal-main-board transitions
  useEffect(() => {
    const prevStage = prevStageRef.current;

    if (state.stage === 'minigame' && state.activeMiniGame) {
      setRenderedMiniGame(state.activeMiniGame);

      if (prevStage !== 'minigame') {
        prevStageRef.current = 'minigame';
        setStageAnim('opening');
        setStingerInfo({
          mode: 'open',
          title: state.activeMiniGame.categoryTitle.toUpperCase(),
          subtitle: `CARD #${state.activeMiniGame.cardNumber} SELECTED`,
          category: state.activeMiniGame.category,
          key: Date.now(),
        });

        const settleTimer = setTimeout(() => {
          setStageAnim('idle');
          setStingerInfo(null);
        }, 620);

        return () => clearTimeout(settleTimer);
      }
      return;
    }

    if (state.stage === 'home') {
      if (prevStage === 'minigame') {
        prevStageRef.current = 'home';
        setStageAnim('closing');
        const closeTimer = setTimeout(() => {
          setRenderedMiniGame(null);
          setIsDealingBoard(false);
          setStageAnim('board-enter');
        }, 320);
        const finishTimer = setTimeout(() => {
          setStageAnim('idle');
          setStingerInfo(null);
        }, 720);
        return () => {
          clearTimeout(closeTimer);
          clearTimeout(finishTimer);
        };
      }

      if (prevStage !== 'home') {
        prevStageRef.current = 'home';
        setRenderedMiniGame(null);
        setIsDealingBoard(false);
        setStingerInfo(null);
        setStageAnim('board-enter');
        const finishTimer = setTimeout(() => setStageAnim('idle'), 480);
        return () => clearTimeout(finishTimer);
      }
      return;
    }

    if (state.stage === 'board') {
      if (prevStage === 'minigame') {
        prevStageRef.current = 'board';
        setStageAnim('closing');
        setStingerInfo({
          mode: 'close',
          title: 'BACK TO MAIN BOARD',
          subtitle: 'SELECT NEXT GAME ICON CARD',
          key: Date.now(),
        });

        const closeTimer = setTimeout(() => {
          setRenderedMiniGame(null);
          setIsDealingBoard(true);
          setStageAnim('board-enter');
        }, 360);

        const finishTimer = setTimeout(() => {
          setStageAnim('idle');
          setIsDealingBoard(false);
          setStingerInfo(null);
        }, 920);

        return () => {
          clearTimeout(closeTimer);
          clearTimeout(finishTimer);
        };
      }

      if (prevStage === 'home') {
        prevStageRef.current = 'board';
        setRenderedMiniGame(null);
        setIsDealingBoard(true);
        setStageAnim('board-enter');
        setStingerInfo({
          mode: 'reveal',
          title: 'MAIN CARD GAME',
          subtitle: 'HOST REVEALING 8 GAME ICON CARDS',
          key: Date.now(),
        });

        const finishTimer = setTimeout(() => {
          setStageAnim('idle');
          setIsDealingBoard(false);
          setStingerInfo(null);
        }, 820);

        return () => clearTimeout(finishTimer);
      }
    }
  }, [state.stage, state.activeMiniGame]);

  // Trigger brief card deal animation ONLY when Shuffle Sports or New Game explicitly increments boardDeckId
  useEffect(() => {
    const currentDeckId = state.boardDeckId || 1;
    if (currentDeckId !== prevDeckIdRef.current) {
      prevDeckIdRef.current = currentDeckId;
      if (state.stage === 'board') {
        setIsDealingBoard(true);
        const timer = setTimeout(() => setIsDealingBoard(false), 620);
        return () => clearTimeout(timer);
      }
    }
  }, [state.boardDeckId, state.stage]);

  // Track score pulse animation
  useEffect(() => {
    if (!state.lastScorePulse) return;
    const elapsed = Date.now() - state.lastScorePulse.timestamp;
    if (elapsed < 2000) {
      setPulseTeam(state.lastScorePulse.team);
      const timer = setTimeout(() => setPulseTeam(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [state.lastScorePulse]);

  // Reset broken image fallback state when snapshot media changes
  useEffect(() => {
    setImgFailed(false);
  }, [renderedMiniGame?.snapshot?.mediaUrl]);

  // Auto-expire temporary "Not Accepted" Tic-Tac-Toe feedback after 3.5s
  const rejectedTimestamp =
    state.stage === 'minigame'
      ? state.activeMiniGame?.ticTacToe?.rejectedFeedback?.timestamp
      : renderedMiniGame?.ticTacToe?.rejectedFeedback?.timestamp;

  useEffect(() => {
    if (!rejectedTimestamp) return;
    setNowTick(Date.now());
    const remaining = Math.max(0, 3550 - (Date.now() - rejectedTimestamp));
    const timer = setTimeout(() => setNowTick(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [rejectedTimestamp]);

  const mg = state.stage === 'minigame' ? state.activeMiniGame : renderedMiniGame;
  const showHome = state.stage === 'home' && stageAnim !== 'closing';
  const showBoard = state.stage === 'board' && stageAnim !== 'closing';
  const activeTeam =
    mg?.category === 'tictactoe' && mg.ticTacToe ? mg.ticTacToe.turn : state.activeTeam;
  const custom = state.customization || {};
  const showTitlePrimary = custom.showTitlePrimary?.trim() || 'FANZONE';
  const showTitleSecondary =
    custom.showTitleSecondary !== undefined ? custom.showTitleSecondary.trim() : 'LIVE';
  const showEyebrow = custom.showEyebrow?.trim() || 'STUDIO BROADCAST SHOW';
  const redTeamName = custom.redTeamName?.trim() || 'RED TEAM';
  const blueTeamName = custom.blueTeamName?.trim() || 'BLUE TEAM';
  const cardAccentColor = custom.cardAccentColor || '#4DB8FF';
  const showLogoScale = resolveShowLogoScale(custom);
  const hideShowTitleText = Boolean(custom.showLogoUrl && custom.hideShowTitleText !== false);

  return (
    <div
      className={`relative w-full h-full bg-[#040F1A] text-white overflow-hidden flex flex-col justify-between font-['Chakra_Petch'] ${
        isPreview
          ? 'p-3 rounded-xl border border-[#38BDF8]/30 select-none'
          : 'w-screen h-screen px-[3.2vw] py-[2.6vh] cursor-none select-none'
      }`}
    >
      {/* Deep Petrol-Navy Gradient & Flowing Oceanic Wave Backdrop */}
      <OceanicBackdrop />

      {/* Optional Custom Studio Stage Background */}
      {custom.stageBgUrl && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={custom.stageBgUrl}
            alt="Studio Stage Backdrop"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#061523]/75 via-[#061523]/55 to-[#040E18]/85" />
        </div>
      )}

      {/* BROADCAST STINGER SWEEP OVERLAY ON HOME REVEAL / MINI-GAME OPEN / CLOSE */}
      {stingerInfo && (
        <div
          key={stingerInfo.key}
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
        >
          <div
            className={`animate-stinger-sweep w-full py-6 flex items-center justify-center gap-4 border-y-2 shadow-2xl ${
              stingerInfo.mode === 'open' || stingerInfo.mode === 'reveal'
                ? 'bg-gradient-to-r from-transparent via-[#0B243A]/95 to-transparent border-[#4DB8FF]'
                : 'bg-gradient-to-r from-transparent via-[#091E31]/95 to-transparent border-[#38BDF8]'
            }`}
          >
            {stingerInfo.category && (
              <CategoryBadgeArtwork
                category={stingerInfo.category}
                customIconUrl={resolveCustomMiniGameIcon(custom, stingerInfo.category)}
                scale={Math.min(1.25, resolveMiniGameIconScale(custom, stingerInfo.category))}
                className={isPreview ? 'w-8 h-8' : 'w-16 h-16'}
              />
            )}
            <div className="text-center">
              <div
                className={`font-['Chakra_Petch'] font-bold tracking-[0.2em] uppercase text-[#4DB8FF] ${
                  isPreview ? 'text-[8px]' : 'text-xs lg:text-sm'
                }`}
              >
                {stingerInfo.subtitle}
              </div>
              <div
                className={`font-['Unbounded'] font-extrabold tracking-wide text-white ${
                  isPreview ? 'text-xs' : 'text-2xl lg:text-4xl'
                }`}
              >
                {stingerInfo.title}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP BROADCAST SCOREBOARD BAR (Hidden on Home Screen so main screen has zero game UI) */}
      {!showHome && (
        <div
          className={`relative z-10 grid grid-cols-12 items-center ${
            isPreview ? 'gap-2 mb-2' : 'gap-5 lg:gap-7 mb-[1.8vh]'
          }`}
        >
          {/* RED TEAM SCOREBOARD (LEFT) */}
          <div
            className={`col-span-4 relative rounded-2xl transition-all duration-300 overflow-hidden backdrop-blur-xl glass-noise ${
              isPreview ? 'px-2.5 py-1.5 border' : 'px-5 py-2.5 lg:py-3 border'
            } ${
              activeTeam === 'red'
                ? 'border-[#FB6F84]/85'
                : 'border-[#38BDF8]/25 opacity-85'
            }`}
            style={{
              background:
                activeTeam === 'red'
                  ? 'linear-gradient(115deg, rgba(16,46,70,0.44) 0%, rgba(102,30,54,0.48) 100%)'
                  : 'linear-gradient(125deg, rgba(14,42,66,0.38) 0%, rgba(7,24,40,0.52) 100%)',
              boxShadow:
                activeTeam === 'red'
                  ? 'inset 0 1px 0 rgba(255,214,224,0.62), 0 12px 32px rgba(251,111,132,0.18)'
                  : 'inset 0 1px 0 rgba(186,230,253,0.18), 0 10px 26px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {custom.redTeamLogoUrl && (
                  <img
                    src={custom.redTeamLogoUrl}
                    alt={redTeamName}
                    className={
                      isPreview
                        ? 'w-5 h-5 object-contain shrink-0'
                        : 'w-9 h-9 lg:w-12 lg:h-12 object-contain shrink-0'
                    }
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-['Unbounded'] font-extrabold tracking-tight text-white truncate ${
                        isPreview ? 'text-[10px]' : 'text-lg lg:text-2xl'
                      }`}
                    >
                      {redTeamName}
                    </span>
                  </div>
                  <p
                    className={`font-['Chakra_Petch'] font-semibold tracking-[0.08em] uppercase ${
                      activeTeam === 'red' ? 'text-[#FB6F84]' : 'text-slate-400'
                    } ${isPreview ? 'text-[7px]' : 'text-[11px] lg:text-xs mt-0.5'}`}
                  >
                    {activeTeam === 'red' ? 'ACTIVE TURN · ON STAGE' : 'STANDBY'}
                  </p>
                </div>
              </div>

              <div
                className={`font-['Unbounded'] font-extrabold tabular-nums transition-transform duration-200 shrink-0 flex items-center justify-center backdrop-blur-md ${
                  isPreview
                    ? 'w-7 h-7 text-sm rounded-lg'
                    : 'w-11 h-11 lg:w-14 lg:h-14 text-2xl lg:text-3xl rounded-xl'
                } bg-[#2B1424]/55 border-2 border-[#E14B68]/80 text-[#FF5C77] shadow-[inset_0_1px_0_rgba(255,190,205,0.28)] ${
                  pulseTeam === 'red' ? 'scale-125 bg-[#FB6F84] text-white' : 'scale-100'
                }`}
              >
                {state.redScore}
              </div>
            </div>
          </div>

          {/* CENTER SHOW TITLE & ROUND SUBTITLE */}
          <div className="col-span-4 flex flex-col items-center justify-center text-center min-w-0">
            <div
              className={`font-['Unbounded'] font-extrabold tracking-tight text-white flex items-center justify-center gap-2 leading-none ${
                isPreview ? 'text-xs' : 'text-xl lg:text-3xl'
              }`}
            >
              {custom.showLogoUrl && (
                <img
                  src={custom.showLogoUrl}
                  alt={showTitlePrimary}
                  className={
                    isPreview
                      ? 'h-5 w-auto max-w-[68px] object-contain shrink-0'
                      : 'h-9 lg:h-11 w-auto max-w-[160px] object-contain shrink-0'
                  }
                />
              )}
              <span>
                <span className="text-[#4DB8FF]">{showTitlePrimary}</span>
                {showTitleSecondary && (
                  <>
                    {' '}
                    <span className="text-white">{showTitleSecondary}</span>
                  </>
                )}
              </span>
            </div>
            <div
              className={`mt-1 font-['Chakra_Petch'] font-semibold text-slate-200 tracking-[0.14em] uppercase truncate max-w-full ${
                isPreview ? 'text-[8px]' : 'text-sm lg:text-lg'
              }`}
            >
              {showBoard || !mg ? 'MAIN GAME BOARD' : mg.categoryTitle.toUpperCase()}
            </div>
          </div>

          {/* BLUE TEAM SCOREBOARD (RIGHT) */}
          <div
            className={`col-span-4 relative rounded-2xl transition-all duration-300 overflow-hidden backdrop-blur-xl glass-noise ${
              isPreview ? 'px-2.5 py-1.5 border' : 'px-5 py-2.5 lg:py-3 border'
            } ${
              activeTeam === 'blue'
                ? 'border-[#4DB8FF]/85'
                : 'border-[#38BDF8]/30 opacity-90'
            }`}
            style={{
              background:
                activeTeam === 'blue'
                  ? 'linear-gradient(235deg, rgba(16,50,76,0.46) 0%, rgba(22,86,126,0.52) 100%)'
                  : 'linear-gradient(235deg, rgba(12,42,66,0.38) 0%, rgba(7,23,38,0.52) 100%)',
              boxShadow:
                activeTeam === 'blue'
                  ? 'inset 0 1px 0 rgba(186,230,253,0.55), 0 12px 32px rgba(77,184,255,0.22)'
                  : 'inset 0 1px 0 rgba(186,230,253,0.18), 0 10px 26px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className={`font-['Unbounded'] font-extrabold tabular-nums transition-transform duration-200 shrink-0 flex items-center justify-center backdrop-blur-md ${
                  isPreview
                    ? 'w-7 h-7 text-sm rounded-lg'
                    : 'w-11 h-11 lg:w-14 lg:h-14 text-2xl lg:text-3xl rounded-xl'
                } bg-[#09243A]/55 border-2 border-[#38BDF8]/65 text-[#4DB8FF] shadow-[inset_0_1px_0_rgba(186,230,253,0.24)] ${
                  pulseTeam === 'blue' ? 'scale-125 bg-[#4DB8FF] text-slate-950' : 'scale-100'
                }`}
              >
                {state.blueScore}
              </div>

              <div className="flex items-center justify-end gap-2.5 min-w-0">
                <div className="text-right min-w-0">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={`font-['Unbounded'] font-extrabold tracking-tight text-white truncate ${
                        isPreview ? 'text-[10px]' : 'text-lg lg:text-2xl'
                      }`}
                    >
                      {blueTeamName}
                    </span>
                  </div>
                  <p
                    className={`font-['Chakra_Petch'] font-semibold tracking-[0.08em] uppercase text-[#4DB8FF] ${
                      isPreview ? 'text-[7px]' : 'text-[11px] lg:text-xs mt-0.5'
                    }`}
                  >
                    {activeTeam === 'blue' ? 'ACTIVE TURN · ON STAGE' : 'STANDBY'}
                  </p>
                </div>
                {custom.blueTeamLogoUrl && (
                  <img
                    src={custom.blueTeamLogoUrl}
                    alt={blueTeamName}
                    className={
                      isPreview
                        ? 'w-5 h-5 object-contain shrink-0'
                        : 'w-9 h-9 lg:w-12 lg:h-12 object-contain shrink-0'
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN STAGE BODY: PURE SHOW TITLE GRAPHIC, 2x4 GAME ICON BOARD, OR ACTIVE MINI GAME */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center">
        {showHome ? (
          /* PURE SHOW TITLE GRAPHIC HOME SCREEN (NO GAME UI, NO SCORES, NO CARDS) */
          <div
            className={`relative w-full h-full flex flex-col items-center justify-center text-center overflow-hidden ${
              stageAnim === 'board-enter' ? 'animate-board-return' : ''
            }`}
          >
            {/* Atmospheric Stadium Pitch Center-Circle & Floodlight Geometry */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="w-[70%] aspect-square rounded-full blur-[95px] opacity-35"
                style={{
                  background:
                    'radial-gradient(circle, rgba(77,184,255,0.42) 0%, rgba(251,111,132,0.16) 52%, transparent 72%)',
                }}
              />
            </div>

            <svg
              viewBox="0 0 1600 900"
              className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="800" cy="450" r="320" stroke="#4DB8FF" strokeWidth="1.5" strokeOpacity="0.45" />
              <circle cx="800" cy="450" r="220" stroke="#FB6F84" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="8 10" />
              <line x1="120" y1="450" x2="1480" y2="450" stroke="#7DD3FC" strokeWidth="1" strokeOpacity="0.2" />
              <line x1="800" y1="80" x2="800" y2="820" stroke="#7DD3FC" strokeWidth="1" strokeOpacity="0.16" />
            </svg>

            {/* Centered Broadcast Show Title Graphic */}
            <div className={`relative z-10 flex flex-col items-center justify-center ${isPreview ? 'gap-2' : 'gap-6 lg:gap-8'}`}>
              {custom.showLogoUrl ? (
                <div className="flex items-center justify-center overflow-visible">
                  <img
                    src={custom.showLogoUrl}
                    alt={showTitlePrimary}
                    style={
                      showLogoScale !== 1
                        ? { transform: `scale(${showLogoScale})` }
                        : undefined
                    }
                    className={`object-contain select-none transition-transform duration-200 ${
                      hideShowTitleText
                        ? isPreview
                          ? 'max-h-28 max-w-[260px] drop-shadow-[0_8px_22px_rgba(77,184,255,0.38)]'
                          : 'max-h-[58vh] max-w-[74vw] drop-shadow-[0_18px_52px_rgba(77,184,255,0.4)]'
                        : isPreview
                          ? 'max-h-20 max-w-[200px] drop-shadow-[0_6px_18px_rgba(77,184,255,0.35)]'
                          : 'max-h-52 lg:max-h-64 max-w-[480px] drop-shadow-[0_14px_45px_rgba(77,184,255,0.35)]'
                    }`}
                  />
                </div>
              ) : (
                /* Bespoke FanZone Live Shield & Football Crest Artwork */
                <svg
                  viewBox="0 0 220 220"
                  className={isPreview ? 'w-14 h-14 drop-shadow-[0_6px_18px_rgba(77,184,255,0.35)]' : 'w-36 h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 drop-shadow-[0_14px_45px_rgba(77,184,255,0.35)]'}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="fzCyanGrad" x1="25" y1="18" x2="195" y2="205" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#BAE6FD" />
                      <stop offset="48%" stopColor="#4DB8FF" />
                      <stop offset="100%" stopColor="#0284C7" />
                    </linearGradient>
                    <linearGradient id="fzShieldCore" x1="110" y1="24" x2="110" y2="196" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#0F304A" />
                      <stop offset="100%" stopColor="#051320" />
                    </linearGradient>
                    <linearGradient id="fzCoralAccent" x1="40" y1="40" x2="180" y2="180" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FDA4AF" />
                      <stop offset="100%" stopColor="#FB7185" />
                    </linearGradient>
                  </defs>

                  <circle cx="110" cy="110" r="102" stroke="url(#fzCyanGrad)" strokeWidth="2.5" strokeOpacity="0.55" />
                  <circle cx="110" cy="110" r="94" stroke="url(#fzCoralAccent)" strokeWidth="1.2" strokeOpacity="0.4" />

                  <path
                    d="M110 22L178 48V108C178 153 149 185 110 200C71 185 42 153 42 108V48L110 22Z"
                    fill="url(#fzShieldCore)"
                    stroke="url(#fzCyanGrad)"
                    strokeWidth="5.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M110 34L166 56V107C166 144 142 172 110 185C78 172 54 144 54 107V56L110 34Z"
                    stroke="#FB6F84"
                    strokeWidth="1.8"
                    strokeOpacity="0.45"
                    strokeLinejoin="round"
                  />

                  <circle cx="110" cy="106" r="36" fill="#061625" stroke="url(#fzCyanGrad)" strokeWidth="4" />
                  <polygon
                    points="110,84 129,98 122,120 98,120 91,98"
                    fill="url(#fzCyanGrad)"
                  />
                  <path d="M110 84V70M129 98L142 93M122 120L131 133M98 120L89 133M91 98L78 93" stroke="#E0F2FE" strokeWidth="3" strokeLinecap="round" />

                  <path
                    d="M110 42L114.5 51.5L125 53L117.5 60.2L119.3 70.5L110 65.5L100.7 70.5L102.5 60.2L95 53L105.5 51.5L110 42Z"
                    fill="url(#fzCyanGrad)"
                  />
                </svg>
              )}

              {/* Show Title Graphic Lockup */}
              {!hideShowTitleText && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center gap-3 w-full">
                    <div className={`h-px bg-gradient-to-r from-transparent to-[#4DB8FF]/80 ${isPreview ? 'w-8' : 'w-20 lg:w-32'}`} />
                    <span
                      className={`font-['Chakra_Petch'] font-bold uppercase tracking-[0.34em] text-[#7DD3FC] ${
                        isPreview ? 'text-[7px]' : 'text-xs lg:text-base'
                      }`}
                    >
                      {showEyebrow}
                    </span>
                    <div className={`h-px bg-gradient-to-l from-transparent to-[#4DB8FF]/80 ${isPreview ? 'w-8' : 'w-20 lg:w-32'}`} />
                  </div>

                  <h1
                    className={`font-['Unbounded'] font-black tracking-tight leading-none text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.75)] ${
                      isPreview ? 'text-xl mt-0.5' : 'text-5xl md:text-6xl lg:text-8xl mt-2.5'
                    }`}
                  >
                    <span className="text-[#4DB8FF]">{showTitlePrimary}</span>
                    {showTitleSecondary && (
                      <>
                        {' '}
                        <span className="text-white">{showTitleSecondary}</span>
                      </>
                    )}
                  </h1>

                  <div className={`mt-3 h-1 rounded-full bg-gradient-to-r from-[#FB6F84] via-[#4DB8FF] to-[#34D399] ${isPreview ? 'w-20' : 'w-56 lg:w-80'}`} />
                </div>
              )}
            </div>
          </div>
        ) : showBoard || !mg ? (
          /* 2 ROWS x 4 COLUMNS GAME ICON CARDS */
          <div
            className={`w-full h-full grid grid-cols-4 grid-rows-2 ${
              isPreview ? 'gap-2' : 'gap-4 lg:gap-6'
            } ${stageAnim === 'board-enter' ? 'animate-board-return' : ''}`}
          >
            {state.cards.map((card, idx) => {
              const isSelected = state.selectedCardNumber === card.cardNumber;
              const slotCustom = custom.cardSlots?.[card.cardNumber];
              const cardBgUrl =
                slotCustom?.cardFrontBgUrl ||
                slotCustom?.cardBackBgUrl ||
                custom.cardFrontBgUrl ||
                custom.cardBackBgUrl;
              return (
                <div
                  key={card.cardNumber}
                  className={`relative w-full h-full rounded-2xl flex flex-col items-center justify-between transition-all duration-300 overflow-hidden backdrop-blur-xl glass-noise ${
                    isPreview ? 'p-2 border' : 'p-4 lg:p-5 border'
                  } ${
                    isSelected
                      ? 'scale-[1.015] opacity-100 border-2'
                      : card.scored
                      ? 'border-[#38BDF8]/25 opacity-85'
                      : 'border-[#5EC8FF]/30 opacity-100'
                  } ${isDealingBoard ? 'animate-card-deal' : ''}`}
                  style={{
                    animationDelay: isDealingBoard ? `${idx * 45}ms` : undefined,
                    background: isSelected
                      ? 'linear-gradient(150deg, rgba(24,80,118,0.52) 0%, rgba(11,38,61,0.58) 60%, rgba(6,20,34,0.68) 100%)'
                      : 'linear-gradient(155deg, rgba(16,52,80,0.42) 0%, rgba(9,31,50,0.50) 60%, rgba(5,18,32,0.62) 100%)',
                    borderColor: isSelected ? cardAccentColor : undefined,
                    boxShadow: isSelected
                      ? `inset 0 1px 0 rgba(224,242,254,0.4), 0 0 28px ${cardAccentColor}50`
                      : 'inset 0 1px 0 rgba(186,230,253,0.22), 0 12px 30px rgba(0,0,0,0.35)',
                  }}
                >
                  {cardBgUrl && (
                    <>
                      <img
                        src={cardBgUrl}
                        alt=""
                        className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-80"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#061523]/30 via-transparent to-[#05111E]/70" />
                    </>
                  )}

                  <div className="relative z-10 w-full flex items-center justify-between shrink-0">
                    <span
                      className={`font-['Chakra_Petch'] font-bold tabular-nums ${
                        isPreview ? 'text-[10px]' : 'text-sm lg:text-base'
                      } ${isSelected ? '' : 'text-slate-400'}`}
                      style={isSelected ? { color: cardAccentColor } : undefined}
                    >
                      #{card.cardNumber}
                    </span>
                    {card.scored && (
                      <span
                        className={`font-['Chakra_Petch'] font-bold uppercase tracking-wider ${
                          isPreview ? 'text-[8px]' : 'text-xs'
                        } ${
                          card.scoreResult === 'correct'
                            ? card.awardedTeam === 'red'
                              ? 'text-[#FB6F84]'
                              : 'text-[#4DB8FF]'
                            : 'text-slate-400'
                        }`}
                      >
                        {card.scoreResult === 'correct'
                          ? `+1 ${card.awardedTeam?.toUpperCase()}`
                          : 'PLAYED'}
                      </span>
                    )}
                  </div>

                  <div
                    className={`relative z-10 flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden ${
                      isPreview ? 'my-0.5 p-0.5' : 'my-1.5 p-2'
                    }`}
                  >
                    <CategoryBadgeArtwork
                      category={card.category}
                      customIconUrl={resolveCustomMiniGameIcon(custom, card.category)}
                      scale={resolveMiniGameIconScale(custom, card.category)}
                      className="w-full h-full max-w-full max-h-full drop-shadow-xl"
                    />
                  </div>

                  {!custom.hideEmojiLabels && (
                    <div
                      className={`relative z-10 shrink-0 font-['Unbounded'] font-bold text-center text-white leading-tight truncate max-w-full ${
                        isPreview ? 'text-[8px]' : 'text-xs lg:text-sm'
                      }`}
                    >
                      {card.categoryTitle}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ANIMATED MINI-GAME STAGE WRAPPER (OPEN & CLOSE TRANSITIONS) */
          <div
            key={`minigame-${mg.cardNumber}-${mg.category}`}
            className={`w-full h-full ${
              stageAnim === 'closing' ? 'animate-minigame-close' : 'animate-minigame-open'
            }`}
          >
            {mg.category === 'tictactoe' && mg.ticTacToe ? (
              /* MINI GAME D: FOOTBALL TIC-TAC-TOE (4x4 OCEANIC BROADCAST GRID) */
              <div className="w-full h-full flex flex-col justify-between gap-2.5">
                {/* Top Instruction & Turn Strip */}
                <div
                  className={`flex items-center justify-between border border-[#5EC8FF]/30 rounded-2xl backdrop-blur-xl glass-noise ${
                    isPreview ? 'px-2.5 py-1.5' : 'px-5 py-2.5'
                  }`}
                  style={{
                    background:
                      'linear-gradient(120deg, rgba(16,52,80,0.44) 0%, rgba(8,28,46,0.56) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(186,230,253,0.24), 0 10px 26px rgba(0,0,0,0.32)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryBadgeArtwork
                      category="tictactoe"
                      customIconUrl={resolveCustomMiniGameIcon(custom, 'tictactoe')}
                      scale={Math.min(1.25, resolveMiniGameIconScale(custom, 'tictactoe'))}
                      className={isPreview ? 'w-5 h-5 shrink-0' : 'w-9 h-9 lg:w-11 lg:h-11 shrink-0'}
                    />
                    <div className="min-w-0">
                      <h2
                        className={`font-['Unbounded'] font-bold text-white truncate ${
                          isPreview ? 'text-[10px]' : 'text-lg lg:text-xl'
                        }`}
                      >
                        FOOTBALL TIC-TAC-TOE
                      </h2>
                      <p
                        className={`font-['Chakra_Petch'] font-semibold text-slate-300 truncate ${
                          isPreview ? 'text-[7px]' : 'text-xs lg:text-sm'
                        }`}
                      >
                        Name a footballer who played for{' '}
                        <span className="text-[#4DB8FF]">both</span> the{' '}
                        <span className="text-[#4DB8FF]">column&apos;s</span> Club and the{' '}
                        <span className="text-[#4DB8FF]">row&apos;s</span> Club
                      </p>
                    </div>
                  </div>

                  {mg.ticTacToe.winner ? (
                    <div
                      className={`rounded-xl font-['Chakra_Petch'] font-bold tracking-wider uppercase animate-answer-reveal shrink-0 ${
                        isPreview ? 'px-2.5 py-1 text-[9px]' : 'px-5 py-2 text-base lg:text-lg'
                      } ${
                        mg.ticTacToe.winner === 'red'
                          ? 'bg-[#FB6F84] text-slate-950 shadow-[0_0_25px_rgba(251,111,132,0.5)]'
                          : mg.ticTacToe.winner === 'blue'
                          ? 'bg-[#4DB8FF] text-slate-950 shadow-[0_0_25px_rgba(77,184,255,0.5)]'
                          : 'bg-slate-200 text-slate-950'
                      }`}
                    >
                      {mg.ticTacToe.winner === 'draw'
                        ? 'GRID COMPLETE · DRAW'
                        : `${mg.ticTacToe.winner.toUpperCase()} TEAM WINS (+1 PT)`}
                    </div>
                  ) : (
                    <div
                      className={`rounded-xl font-['Chakra_Petch'] font-bold tracking-wider uppercase border shrink-0 ${
                        isPreview ? 'px-2 py-0.5 text-[8px]' : 'px-4 py-1.5 text-sm lg:text-base'
                      } ${
                        mg.ticTacToe.turn === 'red'
                          ? 'bg-[#2B1424]/75 border-[#FB6F84]/75 text-[#FB6F84]'
                          : 'bg-[#0B263D]/75 border-[#4DB8FF]/75 text-[#4DB8FF]'
                      }`}
                    >
                      CURRENT TURN: {mg.ticTacToe.turn.toUpperCase()} TEAM
                    </div>
                  )}
                </div>

                {/* 4x4 Broadcast Matrix */}
                <div
                  className={`flex-1 min-h-0 grid grid-cols-4 grid-rows-4 ${
                    isPreview ? 'gap-1.5' : 'gap-3 lg:gap-3.5'
                  }`}
                >
                  {/* Top-Left Corner Legend Cell */}
                  <div
                    className="rounded-xl border border-[#5EC8FF]/28 flex items-center justify-center gap-2.5 p-2 text-center backdrop-blur-lg glass-noise"
                    style={{
                      background:
                        'linear-gradient(145deg, rgba(15,48,74,0.44) 0%, rgba(7,24,40,0.56) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(186,230,253,0.2)',
                    }}
                  >
                    <svg
                      viewBox="0 0 36 36"
                      className={isPreview ? 'w-4 h-4 shrink-0' : 'w-8 h-8 lg:w-9 lg:h-9 shrink-0'}
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18 4C13 4 9.5 7 9.5 11.5C9.5 13 10 14.5 11 15.6C8.8 17.5 7.5 20.5 7.5 24C7.5 28.8 11.5 32 18 32C24.5 32 28.5 28.8 28.5 24C28.5 20.5 27.2 17.5 25 15.6C26 14.5 26.5 13 26.5 11.5C26.5 7 23 4 18 4Z"
                        fill="#E2E8F0"
                        fillOpacity="0.92"
                      />
                      <path d="M12.5 8L15 5.5L18 8L21 5.5L23.5 8" stroke="#4DB8FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="15" cy="14" r="1.4" fill="#071A2B" />
                      <circle cx="21" cy="14" r="1.4" fill="#071A2B" />
                    </svg>
                    <div className="flex flex-col items-start">
                      <span
                        className={`font-['Chakra_Petch'] font-bold text-[#4DB8FF] leading-tight ${
                          isPreview ? 'text-[7px]' : 'text-xs lg:text-sm'
                        }`}
                      >
                        CLUBS →
                      </span>
                      <span
                        className={`font-['Chakra_Petch'] font-bold text-[#4DB8FF] leading-tight ${
                          isPreview ? 'text-[7px]' : 'text-xs lg:text-sm'
                        }`}
                      >
                        ↓ CLUBS
                      </span>
                    </div>
                  </div>

                  {/* Top Row: 3 Club Column Headers */}
                  {mg.ticTacToe.clubs.map((club) => (
                    <div
                      key={club.id}
                      className="rounded-xl border border-[#5EC8FF]/28 flex items-center justify-center gap-3 px-3 py-2 backdrop-blur-lg glass-noise"
                      style={{
                        background:
                          'linear-gradient(145deg, rgba(15,48,74,0.44) 0%, rgba(7,24,40,0.56) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(186,230,253,0.2)',
                      }}
                    >
                      <ClubCrestArtwork
                        clubId={club.id}
                        logoUrl={club.logoUrl}
                        alt={club.name}
                        className={
                          isPreview ? 'w-5 h-5 shrink-0' : 'w-10 h-10 lg:w-12 lg:h-12 shrink-0'
                        }
                      />
                      <span
                        className={`font-['Chakra_Petch'] font-bold uppercase tracking-wide text-white leading-tight truncate ${
                          isPreview ? 'text-[8px]' : 'text-sm lg:text-lg'
                        }`}
                      >
                        {club.name}
                      </span>
                    </div>
                  ))}

                  {/* 3 Rows: Club Row Header + 3 Intersection Squares */}
                  {mg.ticTacToe.nations.map((rowClub, rowIdx) => (
                    <React.Fragment key={rowClub.id}>
                      {/* Left Row Header */}
                      <div
                        className="rounded-xl border border-[#5EC8FF]/28 flex items-center justify-center gap-3 px-3 py-2 backdrop-blur-lg glass-noise"
                        style={{
                          background:
                            'linear-gradient(145deg, rgba(15,48,74,0.44) 0%, rgba(7,24,40,0.56) 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(186,230,253,0.2)',
                        }}
                      >
                        <ClubCrestArtwork
                          clubId={rowClub.id}
                          logoUrl={rowClub.logoUrl}
                          alt={rowClub.name}
                          className={
                            isPreview ? 'w-5 h-5 shrink-0' : 'w-10 h-10 lg:w-12 lg:h-12 shrink-0'
                          }
                        />
                        <span
                          className={`font-['Chakra_Petch'] font-bold uppercase tracking-wide text-white leading-tight truncate ${
                            isPreview ? 'text-[8px]' : 'text-sm lg:text-lg'
                          }`}
                        >
                          {rowClub.name}
                        </span>
                      </div>

                      {/* 3 Intersection Cells */}
                      {[0, 1, 2].map((colIdx) => {
                        const cellIndex = rowIdx * 3 + colIdx;
                        const cell = mg.ticTacToe!.cells[cellIndex];
                        const isSelectedCell = mg.ticTacToe!.selectedCellIndex === cellIndex;
                        const isWinningCell =
                          mg.ticTacToe!.winningLine?.includes(cellIndex) || false;
                        const recentRejection =
                          mg.ticTacToe!.rejectedFeedback &&
                          mg.ticTacToe!.rejectedFeedback.cellIndex === cellIndex &&
                          nowTick - mg.ticTacToe!.rejectedFeedback.timestamp < 3500
                            ? mg.ticTacToe!.rejectedFeedback
                            : null;

                        return (
                          <div
                            key={cellIndex}
                            className={`relative rounded-xl flex flex-col items-center justify-center text-center p-2 transition-all duration-300 backdrop-blur-lg glass-noise ${
                              cell.owner === 'red'
                                ? 'bg-gradient-to-br from-[#F43F5E]/65 to-[#4C1D30]/80 border-2 border-[#FDA4AF] shadow-[0_0_24px_rgba(244,63,94,0.35)] animate-answer-reveal'
                                : cell.owner === 'blue'
                                ? 'bg-gradient-to-br from-[#38BDF8]/65 to-[#0C2F4C]/80 border-2 border-[#BAE6FD] shadow-[0_0_24px_rgba(77,184,255,0.35)] animate-answer-reveal'
                                : recentRejection
                                ? 'bg-[#3D1626]/75 border-2 border-[#FB6F84]'
                                : isSelectedCell
                                ? 'border-2 border-[#4DB8FF]'
                                : 'border border-[#5EC8FF]/28'
                            } ${isWinningCell ? 'ring-4 ring-[#4DB8FF] scale-[1.02]' : ''}`}
                            style={
                              !cell.owner && !recentRejection
                                ? {
                                    background: isSelectedCell
                                      ? 'linear-gradient(155deg, rgba(28,92,135,0.52) 0%, rgba(10,36,58,0.62) 100%)'
                                      : 'linear-gradient(155deg, rgba(13,43,68,0.42) 0%, rgba(6,20,34,0.54) 100%)',
                                    boxShadow: isSelectedCell
                                      ? 'inset 0 1px 0 rgba(186,230,253,0.4), 0 0 24px rgba(77,184,255,0.28)'
                                      : 'inset 0 1px 0 rgba(186,230,253,0.18)',
                                  }
                                : undefined
                            }
                          >
                            <span
                              className={`absolute top-1.5 left-2.5 font-['Chakra_Petch'] font-bold ${
                                isPreview ? 'text-[7px]' : 'text-xs'
                              } ${
                                cell.owner
                                  ? 'text-white/85'
                                  : isSelectedCell
                                  ? 'text-[#7DD3FC]'
                                  : 'text-slate-400'
                              }`}
                            >
                              #{cellIndex + 1}
                            </span>

                            {cell.owner ? (
                              (() => {
                                const photoUrl =
                                  cell.playerImageUrl ||
                                  resolveBzzoiroPlayerImageUrl(cell.playerName);
                                return (
                                  <div className="relative w-full h-full flex flex-col justify-end p-1.5 overflow-hidden">
                                    {photoUrl && (
                                      <img
                                        src={photoUrl}
                                        alt={cell.playerName || 'Player Photo'}
                                        referrerPolicy="no-referrer"
                                        className="absolute inset-0 w-full h-full object-contain p-1 scale-135 transition-all duration-300 drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)] pointer-events-none z-0"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    )}
                                    <div className="relative z-10 w-full flex flex-col items-center shrink-0 bg-black/60 backdrop-blur-md rounded-lg px-2 py-1 border border-white/15 shadow-lg">
                                      <span
                                        className={`font-['Unbounded'] font-bold text-white leading-tight text-center truncate max-w-full drop-shadow-md ${
                                          isPreview ? 'text-[8px]' : 'text-xs lg:text-base'
                                        }`}
                                      >
                                        {cell.playerName}
                                      </span>
                                      <span
                                        className={`font-['Chakra_Petch'] font-bold uppercase tracking-wider ${
                                          isPreview ? 'text-[6px]' : 'text-[10px]'
                                        } text-white/90`}
                                      >
                                        {cell.owner === 'red' ? 'RED TEAM' : 'BLUE TEAM'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : recentRejection ? (
                              <div className="flex flex-col items-center">
                                <span
                                  className={`font-['Unbounded'] font-bold text-[#FDA4AF] uppercase ${
                                    isPreview ? 'text-[8px]' : 'text-base lg:text-lg'
                                  }`}
                                >
                                  NOT ACCEPTED
                                </span>
                                {recentRejection.attemptedName && !isPreview && (
                                  <span className="text-xs text-rose-200/80 mt-0.5">
                                    “{recentRejection.attemptedName}”
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`font-['Unbounded'] font-black tabular-nums ${
                                  isPreview ? 'text-sm' : 'text-3xl lg:text-4xl'
                                } ${isSelectedCell ? 'text-[#4DB8FF]' : 'text-[#A8BDCE]'}`}
                              >
                                {cellIndex + 1}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              /* MINI GAMES: MULTIPLE CHOICE, QUIZ, AUDIO, IMAGE GUESSING */
              <div
                className={`relative w-full h-full flex flex-col justify-between border border-[#5EC8FF]/30 rounded-2xl overflow-hidden backdrop-blur-2xl glass-noise ${
                  isPreview ? 'p-3 gap-2' : 'p-6 lg:p-8 gap-4'
                }`}
                style={{
                  background:
                    'linear-gradient(155deg, rgba(15,49,76,0.40) 0%, rgba(9,31,50,0.50) 55%, rgba(5,19,33,0.62) 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(186,230,253,0.26), 0 24px 60px rgba(0,0,0,0.45)',
                }}
              >
                {/* Top-Right Synchronized Countdown Clock Badge */}
                <div className="relative z-10 w-full flex items-center justify-end shrink-0">
                  <div
                    className={`rounded-xl border flex items-center gap-3 backdrop-blur-md shadow-[inset_0_1px_0_rgba(186,230,253,0.18)] ${
                      isPreview ? 'px-2.5 py-1 gap-2' : 'px-5 py-2.5 gap-4'
                    } ${
                      mg.timerSeconds <= 5 && mg.timerSeconds > 0
                        ? 'bg-[#3A1422]/65 border-[#FB6F84] text-[#FB6F84] animate-pulse shadow-[0_0_24px_rgba(251,111,132,0.45)]'
                        : mg.timerSeconds === 0
                        ? 'bg-[#2B1424]/60 border-[#FB6F84]/60 text-[#FDA4AF]'
                        : mg.timerRunning
                        ? 'bg-[#092942]/60 border-[#4DB8FF] text-[#4DB8FF] shadow-[0_0_20px_rgba(77,184,255,0.28)]'
                        : 'bg-[#04111E]/55 border-[#5EC8FF]/28 text-white'
                    }`}
                  >
                    <span
                      className={`font-['Chakra_Petch'] font-bold uppercase tracking-wider ${
                        isPreview ? 'text-[7px]' : 'text-xs'
                      } ${
                        mg.timerSeconds <= 5 && mg.timerSeconds > 0
                          ? 'text-[#FDA4AF]'
                          : mg.timerRunning
                          ? 'text-[#7DD3FC]'
                          : 'text-slate-300'
                      }`}
                    >
                      {mg.timerSeconds === 0
                        ? 'TIME UP'
                        : mg.timerRunning
                        ? 'LIVE'
                        : 'READY'}
                    </span>
                    <span
                      className={`font-['Unbounded'] font-bold tabular-nums tracking-tight ${
                        isPreview ? 'text-xs' : 'text-2xl lg:text-3xl'
                      }`}
                    >
                      {formatCountdown(mg.timerSeconds)}
                    </span>
                  </div>
                </div>

                {/* Center Stage Content by Category */}
                <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center">
                  {(mg.category === 'jersey' ||
                    mg.category === 'photo' ||
                    mg.category === 'stadium' ||
                    mg.category === 'logo') && (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 min-h-0">
                      <div
                        className={`relative flex-1 w-full max-w-3xl min-h-0 rounded-2xl bg-[#040E18]/58 backdrop-blur-md border border-[#5EC8FF]/25 shadow-[inset_0_1px_0_rgba(186,230,253,0.14)] overflow-hidden flex items-center justify-center ${
                          isPreview ? 'p-2' : 'p-4'
                        }`}
                      >
                        {mg.snapshot?.mediaUrl && !imgFailed ? (
                          <img
                            src={mg.snapshot.mediaUrl}
                            alt={mg.snapshot.title || 'Broadcast Mystery Image'}
                            referrerPolicy="no-referrer"
                            onError={() => setImgFailed(true)}
                            style={{
                              filter:
                                mg.imageUnblurred || mg.answerRevealed
                                  ? 'blur(0px)'
                                  : `blur(${mg.snapshot.blurAmount ?? 28}px)`,
                            }}
                            className={`max-h-full max-w-full object-contain transition-all duration-700 ${
                              mg.imageUnblurred || mg.answerRevealed
                                ? 'scale-100'
                                : 'scale-105'
                            }`}
                          />
                        ) : (
                          /* Zero-Broken-Image Styled Fallback Container */
                          <div
                            style={{
                              filter:
                                mg.imageUnblurred || mg.answerRevealed
                                  ? 'blur(0px)'
                                  : `blur(${mg.snapshot?.blurAmount ?? 28}px)`,
                            }}
                            className="flex flex-col items-center justify-center text-center p-6 transition-all duration-700"
                          >
                            <CategoryBadgeArtwork
                              category={mg.category}
                              customIconUrl={resolveCustomMiniGameIcon(custom, mg.category)}
                              scale={resolveMiniGameIconScale(custom, mg.category)}
                              className={isPreview ? 'w-14 h-14' : 'w-32 h-32'}
                            />
                            <p className="mt-3 font-['Unbounded'] font-bold text-base text-slate-200">
                              {mg.snapshot?.title}
                            </p>
                          </div>
                        )}

                        {/* Mystery Blur Badge Inside Bottom-Right of Media Frame */}
                        {!mg.imageUnblurred &&
                          !mg.answerRevealed &&
                          (mg.snapshot?.blurAmount ?? 28) > 0 && (
                            <div
                              className={`pointer-events-none absolute bottom-2.5 right-3 rounded-lg bg-[#061829]/90 border border-[#38BDF8]/40 font-['Chakra_Petch'] font-bold uppercase tracking-wider text-[#7DD3FC] ${
                                isPreview ? 'px-1.5 py-0.5 text-[7px]' : 'px-3 py-1 text-[11px]'
                              }`}
                            >
                              MYSTERY BLUR ACTIVE ({mg.snapshot?.blurAmount ?? 28}PX)
                            </div>
                          )}
                      </div>

                      {mg.snapshot?.prompt && (
                        <p
                          className={`font-['Unbounded'] font-bold text-white text-center leading-snug max-w-4xl [text-wrap:balance] shrink-0 ${
                            isPreview ? 'text-[10px]' : 'text-lg lg:text-2xl'
                          }`}
                        >
                          {renderBroadcastPrompt(mg.snapshot.prompt)}
                        </p>
                      )}
                    </div>
                  )}

                  {mg.category === 'quiz' && (
                    <div className="w-full max-w-4xl flex flex-col items-center justify-center text-center px-4">
                      <div
                        className={`font-['Unbounded'] font-bold text-white leading-tight [text-wrap:balance] ${
                          isPreview ? 'text-xs' : 'text-2xl lg:text-4xl'
                        }`}
                      >
                        {renderBroadcastPrompt(
                          mg.snapshot?.prompt || 'Prepare for the broadcast question!'
                        )}
                      </div>
                    </div>
                  )}

                  {(mg.category === 'multiple_choice' || mg.category === 'number') && (() => {
                    const optionLetters = ['A', 'B', 'C', 'D'];
                    const letterColors = [
                      'bg-[#4DB8FF] text-slate-950',
                      'bg-[#6EE7B7] text-slate-950',
                      'bg-[#A78BFA] text-slate-950',
                      'bg-[#FB7185] text-slate-950',
                    ];
                    const snapOptions =
                      mg.snapshot?.options && mg.snapshot.options.length >= 2
                        ? mg.snapshot.options
                        : [
                            mg.snapshot?.answer || '91 Goals',
                            '85 Goals',
                            '96 Goals',
                            '100 Goals',
                          ];

                    const isOptionCorrect = (opt: string, idx: number): boolean => {
                      if (!mg.snapshot?.answer) return false;
                      const letter = optionLetters[idx];
                      const ans = mg.snapshot.answer.trim().toLowerCase();
                      const o = opt.trim().toLowerCase();
                      return (
                        ans === letter.toLowerCase() ||
                        ans === o ||
                        ans.startsWith(`${letter.toLowerCase()}:`) ||
                        ans.startsWith(`${letter.toLowerCase()}.`) ||
                        ans.startsWith(`${letter.toLowerCase()} `) ||
                        o.includes(ans) ||
                        ans.includes(o)
                      );
                    };

                    return (
                      <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-4 sm:gap-6 px-4">
                        <div
                          className={`font-['Unbounded'] font-bold text-white leading-snug text-center [text-wrap:balance] ${
                            isPreview ? 'text-[10px] mb-0.5' : 'text-xl lg:text-3xl'
                          }`}
                        >
                          {renderBroadcastPrompt(
                            mg.snapshot?.prompt || 'Which is the correct answer?'
                          )}
                        </div>

                        {/* 4 Broadcast Multiple Choice Cards Grid */}
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                          {snapOptions.slice(0, 4).map((opt, idx) => {
                            const letter = optionLetters[idx] || String(idx + 1);
                            const correct = isOptionCorrect(opt, idx);
                            const revealed = mg.answerRevealed;

                            return (
                              <div
                                key={idx}
                                className={`rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 backdrop-blur-md shadow-[inset_0_1px_0_rgba(186,230,253,0.16)] ${
                                  isPreview ? 'p-1.5' : 'px-4 py-3.5'
                                } ${
                                  revealed
                                    ? correct
                                      ? 'bg-gradient-to-r from-[#064E3B]/75 to-[#065F46]/75 border-2 border-[#34D399] shadow-[0_0_30px_rgba(52,211,153,0.4)] text-white scale-[1.02] animate-answer-reveal'
                                      : 'bg-[#040E18]/45 border-[#38BDF8]/15 text-slate-500 opacity-35'
                                    : 'bg-[#082236]/48 border-[#5EC8FF]/28 text-white shadow-md'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`rounded-lg font-['Chakra_Petch'] font-bold flex items-center justify-center shrink-0 ${
                                      isPreview ? 'w-5 h-5 text-[10px]' : 'w-9 h-9 lg:w-10 lg:h-10 text-sm lg:text-base'
                                    } ${
                                      revealed
                                        ? correct
                                          ? 'bg-[#34D399] text-slate-950 font-black'
                                          : 'bg-slate-800 text-slate-500'
                                        : letterColors[idx % letterColors.length]
                                    }`}
                                  >
                                    {letter}
                                  </div>

                                  <span
                                    className={`font-['Chakra_Petch'] font-bold uppercase tracking-wide truncate ${
                                      isPreview ? 'text-[10px]' : 'text-base lg:text-xl'
                                    } ${
                                      revealed
                                        ? correct
                                          ? 'text-white font-extrabold'
                                          : 'text-slate-500 line-through'
                                        : 'text-white'
                                    }`}
                                  >
                                    {opt}
                                  </span>
                                </div>

                                {revealed && correct && (
                                  <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>CORRECT</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {mg.category === 'audio' && (
                    <div className="w-full max-w-3xl flex flex-col items-center justify-center text-center gap-6 px-4">
                      {/* Broadcast Soundwave Visualizer Box */}
                      <div
                        className={`w-full max-w-2xl rounded-2xl bg-[#040F1A]/56 backdrop-blur-md border border-[#5EC8FF]/25 shadow-[inset_0_1px_0_rgba(186,230,253,0.14)] flex items-center justify-center gap-1.5 ${
                          isPreview ? 'h-12 px-4' : 'h-32 px-10'
                        }`}
                      >
                        {Array.from({ length: 26 }).map((_, i) => {
                          const heights = [36, 58, 82, 46, 94, 68, 40, 88, 52, 96, 62, 34, 76, 64];
                          const h = heights[i % heights.length];
                          return (
                            <div
                              key={i}
                              className={`rounded-full transition-all duration-300 ${
                                isPreview ? 'w-1' : 'w-1.5 lg:w-2'
                              } ${
                                mg.audioPlaying
                                  ? 'bg-gradient-to-t from-[#4DB8FF] via-[#34D399] to-[#7DD3FC] animate-pulse'
                                  : 'bg-slate-600/80'
                              }`}
                              style={{
                                height: mg.audioPlaying ? `${h}%` : '22%',
                                animationDelay: `${(i % 7) * 90}ms`,
                              }}
                            />
                          );
                        })}
                      </div>

                      <div
                        className={`font-['Unbounded'] font-bold text-white leading-snug [text-wrap:balance] ${
                          isPreview ? 'text-[10px]' : 'text-xl lg:text-3xl'
                        }`}
                      >
                        {renderBroadcastPrompt(
                          mg.snapshot?.prompt || 'Listen closely to the mystery football audio clip!'
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Official Answer Banner */}
                <div
                  className={`relative z-10 rounded-xl border transition-all duration-300 flex items-center justify-between backdrop-blur-md shadow-[inset_0_1px_0_rgba(186,230,253,0.14)] ${
                    isPreview ? 'px-3 py-1.5' : 'px-6 py-3.5'
                  } ${
                    mg.answerRevealed
                      ? 'bg-[#062E26]/75 border-2 border-[#34D399] shadow-[0_0_28px_rgba(52,211,153,0.3)] animate-answer-reveal'
                      : 'bg-[#040F1A]/55 border-[#5EC8FF]/24'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-['Chakra_Petch'] font-bold uppercase tracking-[0.1em] shrink-0 ${
                        isPreview ? 'text-[8px]' : 'text-sm lg:text-base'
                      } ${mg.answerRevealed ? 'text-[#34D399]' : 'text-slate-300'}`}
                    >
                      {mg.answerRevealed ? 'OFFICIAL ANSWER' : 'ANSWER LOCKED'}
                    </span>
                    <span className="text-slate-500 shrink-0" aria-hidden="true">
                      ·
                    </span>
                    <span
                      className={`font-['Chakra_Petch'] font-bold uppercase tracking-[0.06em] truncate ${
                        isPreview ? 'text-[9px]' : 'text-lg lg:text-2xl'
                      } ${mg.answerRevealed ? 'text-white font-extrabold' : 'text-slate-300'}`}
                    >
                      {mg.answerRevealed
                        ? mg.snapshot?.answer || 'Revealed'
                        : 'AWAITING HOST REVEAL'}
                    </span>
                  </div>

                  {mg.scored && (
                    <div
                      className={`font-['Unbounded'] font-bold uppercase animate-answer-reveal shrink-0 ${
                        isPreview ? 'text-[8px]' : 'text-sm lg:text-lg'
                      } ${
                        mg.scoreResult === 'correct'
                          ? mg.awardedTeam === 'red'
                            ? 'text-[#FB6F84]'
                            : 'text-[#4DB8FF]'
                          : 'text-slate-300'
                      }`}
                    >
                      {mg.scoreResult === 'correct'
                        ? `+1 POINT AWARDED TO ${mg.awardedTeam?.toUpperCase()} TEAM`
                        : 'ROUND JUDGED · 0 POINTS'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
