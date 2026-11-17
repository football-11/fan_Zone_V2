import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  RotateCcw,
  Eye,
  CheckCircle2,
  XCircle,
  Shuffle,
  ArrowLeft,
  Volume2,
  Square,
  Sparkles,
  RefreshCw,
  Home,
  Tv,
} from 'lucide-react';
import { GameSyncProvider, useGameSync } from '../context/GameSyncContext';
import { OwnerAuthGate } from '../components/OwnerAuthGate';
import { StudioStageView } from '../components/StudioStageView';
import { OceanicBackdrop } from '../components/OceanicBackdrop';
import {
  CategoryBadgeArtwork,
  ClubCrestArtwork,
} from '../components/BroadcastArtwork';
import { ContentItem, resolveCustomMiniGameIcon } from '../types/game';
import { resolveBzzoiroPlayerImageUrl } from '../data/bzzoiroSports';

const HostConsoleBody: React.FC = () => {
  const { state, contentItems, logoutOwner, sendHostAction } = useGameSync();

  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [inlineTitle, setInlineTitle] = useState<string>('');
  const [inlinePrompt, setInlinePrompt] = useState<string>('');
  const [inlineAnswer, setInlineAnswer] = useState<string>('');
  const [inlineBlurAmount, setInlineBlurAmount] = useState<number>(28);
  const [spokenPlayerName, setSpokenPlayerName] = useState<string>('');

  const [inlineOptions, setInlineOptions] = useState<string[]>([
    'Option A',
    'Option B',
    'Option C',
    'Option D',
  ]);

  const mg = state?.activeMiniGame || null;
  const selectedCard =
    state?.cards.find((c) => c.cardNumber === state.selectedCardNumber) || state?.cards[0];

  // Filter saved content items for the active mini-game or currently selected card category
  const activeCategory = mg ? mg.category : selectedCard?.category;
  const isImageGuessCategory =
    activeCategory === 'jersey' ||
    activeCategory === 'photo' ||
    activeCategory === 'stadium' ||
    activeCategory === 'logo';
  const isMultipleChoiceCategory =
    activeCategory === 'multiple_choice' || activeCategory === 'number';
  const categoryItems: ContentItem[] =
    activeCategory && activeCategory !== 'tictactoe'
      ? contentItems.filter(
          (item) =>
            item.category === activeCategory ||
            (isMultipleChoiceCategory && (item.category as string) === 'number')
        )
      : [];

  // Sync inline editor fields when active mini-game snapshot changes
  useEffect(() => {
    if (mg && mg.snapshot) {
      setSelectedItemId(mg.snapshot.itemId || '');
      setInlineTitle(mg.snapshot.title || '');
      setInlinePrompt(mg.snapshot.prompt || '');
      setInlineAnswer(mg.snapshot.answer || '');
      setInlineBlurAmount(
        typeof mg.snapshot.blurAmount === 'number' ? mg.snapshot.blurAmount : 28
      );
      if (mg.snapshot.options && mg.snapshot.options.length >= 2) {
        setInlineOptions(mg.snapshot.options);
      }
    } else if (categoryItems.length > 0) {
      const first = categoryItems[0];
      setSelectedItemId(first.id);
      setInlineTitle(first.title);
      setInlinePrompt(first.prompt);
      setInlineAnswer(first.answer);
      setInlineBlurAmount(typeof first.blurAmount === 'number' ? first.blurAmount : 28);
      if (first.options && first.options.length >= 2) {
        setInlineOptions(first.options);
      }
    }
  }, [mg?.cardNumber, mg?.snapshot?.itemId, activeCategory, contentItems.length]);

  const handleSelectContentDropdown = (itemId: string) => {
    setSelectedItemId(itemId);
    const found = categoryItems.find((i) => i.id === itemId);
    if (found) {
      setInlineTitle(found.title);
      setInlinePrompt(found.prompt);
      setInlineAnswer(found.answer);
      if (found.options && found.options.length >= 2) {
        setInlineOptions(found.options);
      }
      const nextBlur = typeof found.blurAmount === 'number' ? found.blurAmount : 28;
      setInlineBlurAmount(nextBlur);
      if (mg && isImageGuessCategory) {
        sendHostAction('minigame:setBlur', { blurAmount: nextBlur });
      }
    }
  };

  const handleApplySelectedItem = () => {
    sendHostAction('minigame:useItem', {
      itemId: selectedItemId,
      title: inlineTitle,
      prompt: inlinePrompt,
      answer: inlineAnswer,
      options: isMultipleChoiceCategory ? inlineOptions : undefined,
      blurAmount: isImageGuessCategory ? inlineBlurAmount : undefined,
    });
  };

  if (!state) {
    return (
      <div className="relative min-h-screen bg-[#040F1A] text-white flex items-center justify-center font-['Unbounded'] overflow-hidden">
        <OceanicBackdrop fixed />
        <div className="relative z-10 glass-panel glass-noise rounded-2xl px-8 py-6 text-lg font-bold text-[#4DB8FF]">
          Loading Host Console...
        </div>
      </div>
    );
  }

  const ttt = mg?.ticTacToe;
  const activeCellIndex = ttt?.selectedCellIndex ?? 0;
  const activeCell = ttt?.cells[activeCellIndex];
  const activeCellClub = ttt && activeCell ? ttt.clubs[activeCell.col] : null;
  const activeCellNation = ttt && activeCell ? ttt.nations[activeCell.row] : null;
  const activeCellHints = (ttt?.hintsByCell && ttt.hintsByCell[activeCellIndex]) || [];

  return (
    <div className="relative min-h-screen lg:h-dvh lg:overflow-hidden bg-[#040F1A] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans']">
      <OceanicBackdrop fixed />

      {/* Compact Broadcast Top Bar */}
      <header className="sticky top-0 lg:static z-30 shrink-0 flex items-center justify-between gap-4 px-4 py-2 glass-header">
        <Link
          to="/host"
          className="text-base lg:text-lg font-extrabold font-['Unbounded'] tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <span className="text-[#4DB8FF]">FanZone</span> Host Console
        </Link>

        <nav className="flex items-center gap-4 lg:gap-6 text-xs lg:text-sm font-semibold text-slate-300 font-['Chakra_Petch'] overflow-x-auto">
          <Link
            to="/host"
            className="text-[#4DB8FF] hover:text-[#7DD3FC] transition-colors whitespace-nowrap shrink-0"
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

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={logoutOwner}
            className="min-h-[36px] px-3 py-1.5 text-xs font-bold text-slate-200 glass-panel-deep rounded-xl hover:border-[#4DB8FF]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Zero-Scroll iPad Landscape Two-Column Studio Cockpit */}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1640px] w-full mx-auto p-2.5 lg:p-3 xl:p-4 grid grid-cols-1 lg:grid-cols-12 gap-2.5 lg:gap-3 xl:gap-4 lg:overflow-hidden">
        {/* LEFT COLUMN (5 cols): Live 16:9 Monitor + 2x4 Cards + Stage/Deck Command Bar */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 min-h-0 lg:h-full">
          {/* 1. Compact Live 16:9 Studio Monitor */}
          <section className="shrink-0 glass-panel glass-noise rounded-2xl p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Tv className="w-3.5 h-3.5 text-[#4DB8FF] shrink-0" />
                <h2 className="text-xs font-bold font-['Unbounded'] text-white truncate">
                  Live Studio Monitor
                </h2>
                <span className="text-[10px] font-['Chakra_Petch'] font-bold tracking-wider text-[#7DD3FC] uppercase truncate">
                  ·{' '}
                  {state.stage === 'home'
                    ? 'Home Screen'
                    : state.stage === 'board'
                    ? '2×4 Board'
                    : mg?.categoryTitle}
                </span>
              </div>
              <div className="text-[11px] font-['Chakra_Petch'] font-bold tracking-wider px-2 py-0.5 rounded-md glass-panel-deep text-[#7DD3FC] shrink-0">
                R {state.redScore} · B {state.blueScore}
              </div>
            </div>

            <div className="w-full flex justify-center">
              <div className="w-full max-w-[330px] xl:max-w-[420px] aspect-video rounded-xl overflow-hidden shadow-2xl border border-[#5EC8FF]/25">
                <StudioStageView state={state} isPreview={true} />
              </div>
            </div>
          </section>

          {/* 2. Interactive 2x4 Game Icon Cards Grid */}
          <section className="flex-1 min-h-0 glass-panel glass-noise rounded-2xl p-2.5 flex flex-col gap-2">
            <div className="shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-xs font-bold font-['Unbounded'] text-white whitespace-nowrap">
                  2×4 Game Cards
                </h2>
                <span className="text-[11px] font-['Chakra_Petch'] font-bold text-[#4DB8FF] whitespace-nowrap">
                  · Selected #{state.selectedCardNumber}
                </span>
              </div>
              <Link
                to="/customize"
                className="min-h-[28px] px-2.5 py-1 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-[11px] font-bold text-[#7DD3FC] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Customize</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-rows-2 flex-1 min-h-0 gap-2">
              {state.cards.map((card) => {
                const isSelected = state.selectedCardNumber === card.cardNumber;
                const isLiveMiniGame =
                  state.stage === 'minigame' && mg?.cardNumber === card.cardNumber;
                return (
                  <button
                    key={card.cardNumber}
                    type="button"
                    onClick={() =>
                      sendHostAction('card:select', { cardNumber: card.cardNumber })
                    }
                    className={`min-h-[88px] lg:min-h-0 lg:h-full p-2 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer backdrop-blur-md ${
                      isLiveMiniGame
                        ? 'bg-[#0E3958]/75 border-2 border-[#34D399] shadow-[0_0_20px_rgba(52,211,153,0.28)]'
                        : isSelected
                        ? 'bg-[#0C3554]/70 border-2 border-[#4DB8FF] shadow-[0_0_18px_rgba(77,184,255,0.28)]'
                        : 'glass-panel-deep hover:border-[#4DB8FF]/60 hover:bg-[#0A2B45]/60'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between gap-1">
                      <span className="font-['Chakra_Petch'] font-bold text-xs text-[#4DB8FF] tabular-nums">
                        #{card.cardNumber}
                      </span>
                      <span
                        className={`text-[10px] font-semibold font-['Chakra_Petch'] truncate ${
                          isLiveMiniGame
                            ? 'text-[#34D399] font-bold'
                            : isSelected
                            ? 'text-[#7DD3FC] font-bold'
                            : card.scored
                            ? card.scoreResult === 'correct'
                              ? card.awardedTeam === 'red'
                                ? 'text-[#FB6F84] font-bold'
                                : 'text-[#4DB8FF] font-bold'
                              : 'text-slate-300 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {isLiveMiniGame
                          ? 'Live'
                          : isSelected
                          ? 'Sel'
                          : card.scored
                          ? card.scoreResult === 'correct'
                            ? `+1 ${card.awardedTeam?.toUpperCase()}`
                            : 'Done'
                          : 'Tap'}
                      </span>
                    </div>

                    <div className="w-full flex items-center justify-center my-0.5">
                      <CategoryBadgeArtwork
                        category={card.category}
                        customIconUrl={resolveCustomMiniGameIcon(
                          state.customization,
                          card.category
                        )}
                        className="w-8 h-8 xl:w-10 xl:h-10 shrink-0"
                      />
                    </div>

                    <div className="w-full">
                      <div className="text-[10px] xl:text-[11px] font-bold font-['Unbounded'] text-white truncate text-center">
                        {card.categoryTitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Unified Studio Stage & Board Actions Bar */}
          <section className="shrink-0 glass-panel glass-noise rounded-2xl p-2.5 space-y-2">
            {/* Stage Reveal / Home Switch */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => sendHostAction('stage:revealBoard')}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  state.stage === 'home'
                    ? 'bg-[#34D399] hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                    : state.stage === 'board'
                    ? 'bg-emerald-950/60 border border-[#34D399]/60 text-[#34D399] hover:bg-emerald-900/60'
                    : 'bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 shadow-[0_0_18px_rgba(77,184,255,0.25)]'
                }`}
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {state.stage === 'board' ? 'Main Board Live' : 'Reveal Main Board'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => sendHostAction('stage:showHome')}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  state.stage === 'home'
                    ? 'bg-[#4DB8FF]/20 border border-[#4DB8FF] text-[#7DD3FC]'
                    : 'glass-panel-deep hover:border-[#4DB8FF]/60 text-slate-200'
                }`}
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span>{state.stage === 'home' ? 'Home Screen Active' : 'Show Home Screen'}</span>
              </button>
            </div>

            {/* Open Mini Game + Shuffle + New Game */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  sendHostAction('card:openMiniGame', {
                    cardNumber: state.selectedCardNumber,
                    itemId: selectedItemId || undefined,
                  })
                }
                className="flex-1 min-h-[42px] px-3 py-1.5 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-[0_0_20px_rgba(77,184,255,0.28)]"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Open Mini Game (#{state.selectedCardNumber})</span>
              </button>

              <button
                type="button"
                onClick={() => sendHostAction('board:shuffleSports')}
                title="Shuffle Games"
                className="min-h-[42px] px-3 py-1.5 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5 shrink-0 text-[#4DB8FF]" />
                <span>Shuffle</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmNewGame(true)}
                title="Reset scores & start a new game"
                className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[#FB6F84]/15 hover:bg-[#FB6F84]/25 border border-[#FB6F84]/45 text-xs font-semibold text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>New Game</span>
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (7 cols): Team Turn/Score Strip + Contextual Live Operator Panel */}
        <div className="lg:col-span-7 flex flex-col gap-2.5 min-h-0 lg:h-full">
          {/* 1. COMPACT SIDE-BY-SIDE TEAM TURN & SCORE STRIP */}
          <section className="shrink-0 glass-panel glass-noise rounded-2xl p-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Red Team Compact Strip */}
              <div
                className={`p-2.5 rounded-xl border backdrop-blur-md transition-all flex flex-col gap-1.5 ${
                  state.activeTeam === 'red'
                    ? 'bg-gradient-to-br from-[#2E1324]/75 to-[#561C34]/70 border-[#FB6F84] shadow-[inset_0_1px_0_rgba(255,205,220,0.4)]'
                    : 'glass-panel-deep'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-['Unbounded'] font-extrabold text-xs text-[#FB6F84] truncate">
                    {state.customization?.redTeamName || 'RED TEAM'}
                  </span>
                  <span className="font-['Unbounded'] font-extrabold text-xl text-white tabular-nums shrink-0 leading-none">
                    {state.redScore}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => sendHostAction('team:setActive', { team: 'red' })}
                    className={`flex-1 min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      state.activeTeam === 'red'
                        ? 'bg-[#FB6F84] text-slate-950'
                        : 'glass-panel-deep text-slate-200 hover:border-[#FB6F84]/60'
                    }`}
                  >
                    {state.activeTeam === 'red' ? 'Active: Red Turn' : 'Set Red Turn'}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendHostAction('score:adjust', { team: 'red', delta: -1 })}
                    className="min-h-[38px] min-w-[40px] px-2 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/50 font-['JetBrains_Mono'] font-bold text-xs text-slate-200 cursor-pointer shrink-0"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => sendHostAction('score:adjust', { team: 'red', delta: 1 })}
                    className="min-h-[38px] min-w-[40px] px-2 rounded-lg bg-[#FB6F84]/25 hover:bg-[#FB6F84]/40 border border-[#FB6F84]/55 font-['JetBrains_Mono'] font-bold text-xs text-rose-100 cursor-pointer shrink-0"
                  >
                    +1
                  </button>
                </div>
              </div>

              {/* Blue Team Compact Strip */}
              <div
                className={`p-2.5 rounded-xl border backdrop-blur-md transition-all flex flex-col gap-1.5 ${
                  state.activeTeam === 'blue'
                    ? 'bg-gradient-to-br from-[#0D3350]/75 to-[#144E78]/70 border-[#4DB8FF] shadow-[inset_0_1px_0_rgba(186,230,253,0.4)]'
                    : 'glass-panel-deep'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-['Unbounded'] font-extrabold text-xs text-[#4DB8FF] truncate">
                    {state.customization?.blueTeamName || 'BLUE TEAM'}
                  </span>
                  <span className="font-['Unbounded'] font-extrabold text-xl text-white tabular-nums shrink-0 leading-none">
                    {state.blueScore}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => sendHostAction('team:setActive', { team: 'blue' })}
                    className={`flex-1 min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      state.activeTeam === 'blue'
                        ? 'bg-[#4DB8FF] text-slate-950'
                        : 'glass-panel-deep text-slate-200 hover:border-[#4DB8FF]/60'
                    }`}
                  >
                    {state.activeTeam === 'blue' ? 'Active: Blue Turn' : 'Set Blue Turn'}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendHostAction('score:adjust', { team: 'blue', delta: -1 })}
                    className="min-h-[38px] min-w-[40px] px-2 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/50 font-['JetBrains_Mono'] font-bold text-xs text-slate-200 cursor-pointer shrink-0"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => sendHostAction('score:adjust', { team: 'blue', delta: 1 })}
                    className="min-h-[38px] min-w-[40px] px-2 rounded-lg bg-[#4DB8FF]/25 hover:bg-[#4DB8FF]/40 border border-[#4DB8FF]/55 font-['JetBrains_Mono'] font-bold text-xs text-sky-100 cursor-pointer shrink-0"
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2. CONTEXTUAL LIVE MINI-GAME / CARD OPERATOR PANEL */}
          {mg && mg.category === 'tictactoe' && mg.ticTacToe ? (
            /* FOOTBALL TIC-TAC-TOE HOST OPERATOR CONTROLS */
            <section
              key={`host-ttt-${mg.cardNumber}`}
              className="flex-1 min-h-0 glass-panel glass-noise rounded-2xl p-3 flex flex-col justify-between gap-2 animate-minigame-open"
            >
              {/* Header + Turn Toggle + Reset/Shuffle */}
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs lg:text-sm font-bold font-['Unbounded'] text-white whitespace-nowrap">
                  Football Tic-Tac-Toe
                </h2>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => sendHostAction('tictactoe:setTurn', { team: 'red' })}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                      mg.ticTacToe.turn === 'red'
                        ? 'bg-[#FB6F84] text-slate-950'
                        : 'glass-panel-deep text-slate-300'
                    }`}
                  >
                    Red Turn
                  </button>
                  <button
                    type="button"
                    onClick={() => sendHostAction('tictactoe:setTurn', { team: 'blue' })}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                      mg.ticTacToe.turn === 'blue'
                        ? 'bg-[#4DB8FF] text-slate-950'
                        : 'glass-panel-deep text-slate-300'
                    }`}
                  >
                    Blue Turn
                  </button>
                  <button
                    type="button"
                    onClick={() => sendHostAction('tictactoe:resetShuffle')}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-[11px] font-semibold text-[#7DD3FC] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Reset Grid</span>
                  </button>
                </div>
              </div>

              {/* 3x3 Touch Square Selector (Squares 1-9) */}
              <div className="flex-1 min-h-0 grid grid-cols-3 lg:grid-rows-3 gap-2">
                {mg.ticTacToe.cells.map((cell, idx) => {
                  const club = mg.ticTacToe!.clubs[cell.col];
                  const nation = mg.ticTacToe!.nations[cell.row];
                  const isSelected = activeCellIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        sendHostAction('tictactoe:selectCell', { cellIndex: idx })
                      }
                      className={`min-h-[54px] lg:min-h-0 lg:h-full p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer backdrop-blur-md ${
                        cell.owner === 'red'
                          ? 'bg-[#FB6F84]/25 border-[#FB6F84] text-white'
                          : cell.owner === 'blue'
                          ? 'bg-[#4DB8FF]/25 border-[#4DB8FF] text-white'
                          : isSelected
                          ? 'bg-[#0C3554]/65 border-2 border-[#4DB8FF] shadow-[0_0_16px_rgba(77,184,255,0.25)]'
                          : 'glass-panel-deep hover:border-[#4DB8FF]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono'] font-bold">
                        <span className="text-[#4DB8FF]">#{idx + 1}</span>
                        <span className="truncate ml-1">
                          {club.shortName} × {nation.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {cell.owner && (() => {
                          const photoUrl =
                            cell.playerImageUrl || resolveBzzoiroPlayerImageUrl(cell.playerName);
                          return photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={cell.playerName || 'Player'}
                              referrerPolicy="no-referrer"
                              className="w-5 h-5 object-contain shrink-0 drop-shadow"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : null;
                        })()}
                        <div className="text-[11px] font-bold font-['Unbounded'] truncate">
                          {cell.owner ? cell.playerName : 'Open'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Intersection Details + Quick-Fill Hints + Judge Controls */}
              <div className="shrink-0 p-2.5 rounded-xl glass-panel-deep space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {activeCellClub && (
                      <ClubCrestArtwork
                        clubId={activeCellClub.id}
                        logoUrl={activeCellClub.logoUrl}
                        alt={activeCellClub.name}
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                    <span className="text-xs font-bold text-white truncate">
                      {activeCellClub?.name}
                    </span>
                    <span className="text-slate-400">×</span>
                    {activeCellNation && (
                      <ClubCrestArtwork
                        clubId={activeCellNation.id}
                        logoUrl={activeCellNation.logoUrl}
                        alt={activeCellNation.name}
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                    <span className="text-xs font-bold text-white truncate">
                      {activeCellNation?.name}
                    </span>
                  </div>
                  <span className="text-xs font-['JetBrains_Mono'] font-bold text-[#4DB8FF] shrink-0">
                    Square #{activeCellIndex + 1}
                  </span>
                </div>

                {/* Quick-Fill Reference Hints */}
                {activeCellHints.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-[68px] overflow-y-auto pr-1">
                    {activeCellHints.map((hintName) => {
                      const hintPhoto = resolveBzzoiroPlayerImageUrl(hintName);
                      return (
                        <button
                          key={hintName}
                          type="button"
                          onClick={() => setSpokenPlayerName(hintName)}
                          className="min-h-[30px] px-2 py-0.5 rounded-lg glass-panel-deep hover:border-[#4DB8FF]/60 text-[11px] text-[#34D399] font-medium cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          {hintPhoto && (
                            <img
                              src={hintPhoto}
                              alt=""
                              className="w-3.5 h-3.5 object-contain shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span>{hintName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={spokenPlayerName}
                    onChange={(e) => setSpokenPlayerName(e.target.value)}
                    placeholder="Type contestant's spoken footballer name..."
                    className="w-full min-h-[38px] pl-3 pr-10 py-1.5 rounded-xl glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                  />
                  {spokenPlayerName.trim() && (() => {
                    const previewPhoto = resolveBzzoiroPlayerImageUrl(spokenPlayerName.trim());
                    return previewPhoto ? (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-0.5 glass-panel-deep rounded-md">
                        <img
                          src={previewPhoto}
                          alt="Preview"
                          className="w-6 h-6 object-contain drop-shadow"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={Boolean(activeCell?.owner || mg.ticTacToe.winner)}
                    onClick={() => {
                      const nameToUse =
                        spokenPlayerName.trim() || activeCellHints[0] || 'Accepted Player';
                      sendHostAction('tictactoe:judge', {
                        cellIndex: activeCellIndex,
                        decision: 'accept',
                        playerName: nameToUse,
                      });
                      setSpokenPlayerName('');
                    }}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#34D399] hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Accept ({mg.ticTacToe.turn === 'red' ? 'Red' : 'Blue'})
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(activeCell?.owner || mg.ticTacToe.winner)}
                    onClick={() => {
                      sendHostAction('tictactoe:judge', {
                        cellIndex: activeCellIndex,
                        decision: 'reject',
                        playerName: spokenPlayerName.trim(),
                      });
                      setSpokenPlayerName('');
                    }}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FB6F84] hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Reject & Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendHostAction('minigame:backToBoard')}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Back to Board</span>
                  </button>
                </div>
              </div>
            </section>
          ) : (
            /* STANDARD MINI GAMES (IMAGE GUESSING, QUIZ, MULTIPLE CHOICE, AUDIO) CONTROLS */
            <section
              key={`host-panel-${state.stage}-${mg?.cardNumber ?? 'board'}`}
              className={`flex-1 min-h-0 glass-panel glass-noise rounded-2xl p-3 flex flex-col justify-between gap-2 ${
                mg ? 'animate-minigame-open' : 'animate-board-return'
              }`}
            >
              {/* Panel Header */}
              <div className="shrink-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-xs lg:text-sm font-bold font-['Unbounded'] text-white truncate">
                    {mg
                      ? `Live Controls · #${mg.cardNumber} ${mg.categoryTitle}`
                      : `Prep Card #${state.selectedCardNumber} · ${selectedCard?.categoryTitle || ''}`}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mg && (
                    <span className="font-['Chakra_Petch'] font-bold text-sm px-2.5 py-0.5 rounded-lg glass-panel-deep text-[#4DB8FF] tabular-nums">
                      00:{String(mg.timerSeconds).padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>

              {/* Content Item Selector & Inline Editor */}
              {activeCategory !== 'tictactoe' ? (
                <div className="flex-1 min-h-0 p-2.5 rounded-xl glass-panel-deep flex flex-col justify-between gap-2 overflow-y-auto">
                  {/* Saved Item Selector + Apply Button Inline */}
                  <div className="space-y-1 shrink-0">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Saved {activeCategory?.toUpperCase()} Item ({categoryItems.length} available)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedItemId}
                        onChange={(e) => handleSelectContentDropdown(e.target.value)}
                        className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1 rounded-xl bg-[#04111E]/90 border border-[#5EC8FF]/30 text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                      >
                        {categoryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title} — [{item.answer}]
                            {isImageGuessCategory ? ` (${item.blurAmount ?? 28}px blur)` : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleApplySelectedItem}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#4DB8FF]/20 border border-[#4DB8FF]/55 hover:bg-[#4DB8FF]/35 text-xs font-bold text-[#7DD3FC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Apply Item
                      </button>
                    </div>
                  </div>

                  {/* Side-by-Side Prompt & Private Official Answer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Question / Clue Prompt
                      </label>
                      <input
                        type="text"
                        value={inlinePrompt}
                        onChange={(e) => setInlinePrompt(e.target.value)}
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl glass-panel-deep text-xs text-white focus:outline-none focus:border-[#4DB8FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Private Official Answer
                      </label>
                      <input
                        type="text"
                        value={inlineAnswer}
                        onChange={(e) => setInlineAnswer(e.target.value)}
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl glass-panel-deep border-[#34D399]/50 text-xs text-[#34D399] font-semibold focus:outline-none focus:border-[#34D399]"
                      />
                    </div>
                  </div>

                  {/* Mystery Blur Control (Image Categories) */}
                  {isImageGuessCategory && (
                    <div className="p-2 rounded-xl glass-panel-deep space-y-1.5 shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#4DB8FF]">
                          Mystery Blur Control (Live on /studio)
                        </span>
                        <span className="font-['JetBrains_Mono'] font-bold text-[11px] px-2 py-0.5 rounded bg-[#4DB8FF]/15 border border-[#4DB8FF]/40 text-[#7DD3FC] tabular-nums">
                          {inlineBlurAmount}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={2}
                        value={inlineBlurAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setInlineBlurAmount(val);
                          if (mg) {
                            sendHostAction('minigame:setBlur', { blurAmount: val });
                          }
                        }}
                        className="w-full accent-[#4DB8FF] cursor-pointer"
                      />
                      <div className="grid grid-cols-6 gap-1">
                        {[
                          { label: '0px', val: 0 },
                          { label: '12px', val: 12 },
                          { label: '20px', val: 20 },
                          { label: '28px', val: 28 },
                          { label: '40px', val: 40 },
                          { label: '52px', val: 52 },
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => {
                              setInlineBlurAmount(preset.val);
                              if (mg) {
                                sendHostAction('minigame:setBlur', { blurAmount: preset.val });
                              }
                            }}
                            className={`min-h-[28px] px-1.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                              inlineBlurAmount === preset.val
                                ? 'bg-[#4DB8FF] text-slate-950'
                                : 'glass-panel-deep text-slate-300 hover:border-[#4DB8FF]/60'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Multiple Choice Options A-D */}
                  {isMultipleChoiceCategory && (
                    <div className="p-2 rounded-xl glass-panel-deep space-y-1.5 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#4DB8FF]">
                          Options A–D (Tap letter to mark correct)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['A', 'B', 'C', 'D'].map((letter, idx) => {
                          const currentOpt = inlineOptions[idx] || '';
                          const isCurrentAnswer =
                            (inlineAnswer.trim().toLowerCase() === currentOpt.trim().toLowerCase() &&
                              currentOpt.trim() !== '') ||
                            inlineAnswer.trim().toUpperCase() === letter;

                          return (
                            <div
                              key={letter}
                              className={`flex items-center gap-1.5 p-1 rounded-lg border transition-colors ${
                                isCurrentAnswer
                                  ? 'bg-[#064E3B]/55 border-[#34D399]/75 text-emerald-200 ring-1 ring-[#34D399]/40'
                                  : 'glass-panel-deep text-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                title={`Set Option ${letter} as correct answer`}
                                onClick={() => {
                                  setInlineAnswer(currentOpt || letter);
                                }}
                                className={`w-7 h-7 rounded-md font-['Chakra_Petch'] font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                                  isCurrentAnswer
                                    ? 'bg-[#34D399] text-slate-950 shadow-sm'
                                    : 'bg-[#0C3554] text-slate-200 hover:bg-[#4DB8FF] hover:text-slate-950'
                                }`}
                              >
                                {letter}
                              </button>
                              <input
                                type="text"
                                value={currentOpt}
                                placeholder={`Option ${letter}`}
                                onChange={(e) => {
                                  const updated = [...inlineOptions];
                                  updated[idx] = e.target.value;
                                  setInlineOptions(updated);
                                  if (isCurrentAnswer) {
                                    setInlineAnswer(e.target.value);
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

                  {/* Synchronized Audio Playback Controls */}
                  {mg?.category === 'audio' && (
                    <div className="p-2 rounded-xl glass-panel-deep border-[#4DB8FF]/40 flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => sendHostAction('minigame:audioPlay')}
                        className="min-h-[36px] px-3 py-1 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Play Audio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => sendHostAction('minigame:audioStop')}
                        className="min-h-[36px] px-3 py-1 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop</span>
                      </button>
                      <span className="text-[11px] font-semibold text-[#7DD3FC] whitespace-nowrap shrink-0">
                        {mg.audioPlaying ? 'Playing on Studio' : 'Stopped'}
                      </span>
                      {mg.snapshot?.mediaUrl && (
                        <audio
                          controls
                          src={mg.snapshot.mediaUrl}
                          className="flex-1 min-w-[160px] h-8"
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 p-3 rounded-xl glass-panel-deep flex flex-col justify-center items-center text-center gap-2">
                  <span className="text-xs font-bold font-['Unbounded'] text-[#4DB8FF]">
                    Card #{state.selectedCardNumber}: Football Tic-Tac-Toe Selected
                  </span>
                  <p className="text-xs text-slate-300 max-w-md">
                    Press <strong className="text-white">Open Mini Game</strong> on the left bar to launch the 3×3 Club × Nation intersection grid.
                  </p>
                </div>
              )}

              {/* Pinned Bottom Live Action Dock: Timer, Reveal, Judge, Back to Board */}
              <div className="shrink-0 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!mg}
                    onClick={() => sendHostAction('minigame:startTimer')}
                    className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-[#4DB8FF] hover:bg-[#7DD3FC] disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-[0_0_16px_rgba(77,184,255,0.2)]"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>Start 30s</span>
                  </button>

                  <button
                    type="button"
                    disabled={!mg}
                    onClick={() => sendHostAction('minigame:resetTimer')}
                    className="min-h-[42px] px-2.5 py-1.5 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 disabled:opacity-40 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Reset Timer</span>
                  </button>

                  <button
                    type="button"
                    disabled={!mg}
                    onClick={() => sendHostAction('minigame:revealAnswer')}
                    className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-[#34D399] hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-[0_0_18px_rgba(52,211,153,0.22)]"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>Reveal Answer</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!mg || mg.scored}
                    onClick={() =>
                      sendHostAction('minigame:judge', {
                        result: 'correct',
                        team: state.activeTeam,
                      })
                    }
                    className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-emerald-500/85 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Correct (+1 {state.activeTeam === 'red' ? 'Red' : 'Blue'})
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!mg || mg.scored}
                    onClick={() =>
                      sendHostAction('minigame:judge', {
                        result: 'wrong',
                        team: state.activeTeam,
                      })
                    }
                    className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#FB6F84] hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Wrong (0)</span>
                  </button>

                  <button
                    type="button"
                    disabled={!mg}
                    onClick={() => sendHostAction('minigame:backToBoard')}
                    className="min-h-[44px] px-2.5 py-1.5 rounded-xl glass-panel-deep hover:border-[#4DB8FF]/60 disabled:opacity-40 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Back to Board</span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Non-Shifting Confirmation Modal for New Game */}
      {confirmNewGame && (
        <div className="fixed inset-0 z-50 bg-[#040F1A]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel glass-noise rounded-2xl max-w-md w-full p-5 border border-[#FB6F84]/60 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold font-['Unbounded'] text-white">
              Start Brand-New Game?
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              This will reset Red &amp; Blue scores to 0, shuffle a brand-new 2×4 board, and return the Studio Display to the Home Screen.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmNewGame(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl glass-panel-deep text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  sendHostAction('board:newGame');
                  setConfirmNewGame(false);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FB6F84] hover:bg-rose-400 text-slate-950 text-xs font-extrabold cursor-pointer whitespace-nowrap"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HostPage: React.FC = () => {
  return (
    <GameSyncProvider role="host">
      <OwnerAuthGate
        title="FanZone Host Control Console"
        subtitle="iPad Live Broadcast Operator Authentication"
      >
        <HostConsoleBody />
      </OwnerAuthGate>
    </GameSyncProvider>
  );
};
