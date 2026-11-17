import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  BoardCard,
  ContentCategory,
  ContentItem,
  FIXED_EMOJI_COVERS,
  GameSessionState,
  MINI_GAME_CATEGORIES,
  MiniGameCategory,
  StudioCustomization,
  TeamId,
  TicTacToeClub,
  TicTacToeNation,
  TicTacToeState,
} from '../types/game';
import {
  removeContentItemFromFirestore,
  signInOwnerWithGoogle,
  signOutOwner,
  syncContentItemToFirestore,
  syncGameSessionToFirestore,
  subscribeToGameSession,
  syncStudioCustomizationToFirestore,
  subscribeToStudioCustomization,
} from '../firebase';
import { BZZOIRO_CLUB_POOL, resolveBzzoiroPlayerImageUrl } from '../data/bzzoiroSports';

interface OwnerAuthState {
  authenticated: boolean;
  token: string | null;
  email: string | null;
  method: 'google' | 'passcode' | null;
}

interface GameSyncContextValue {
  state: GameSessionState | null;
  contentItems: ContentItem[];
  connected: boolean;
  syncError: string | null;
  syncQuotaExceeded: boolean;
  ownerAuth: OwnerAuthState;
  authError: string | null;
  loginWithPasscode: (passcode: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logoutOwner: () => void;
  sendHostAction: (action: string, payload?: Record<string, any>) => Promise<void>;
  forceSync: () => Promise<void>;
  refreshContentItems: () => Promise<void>;
  createContentItem: (itemInput: {
    category: ContentCategory;
    title: string;
    prompt: string;
    answer: string;
    options?: string[];
    mediaUrl?: string;
    blurAmount?: number;
  }) => Promise<void>;
  updateContentItem: (
    id: string,
    updates: {
      title?: string;
      prompt?: string;
      answer?: string;
      options?: string[];
      mediaUrl?: string;
      blurAmount?: number;
    }
  ) => Promise<void>;
  deleteContentItem: (id: string) => Promise<void>;
  audioElementRef: React.RefObject<HTMLAudioElement | null>;
}

const AUTH_STORAGE_KEY = 'fanzone_owner_auth';
const STATE_STORAGE_KEY = 'fanzone_live_state_v1';
const CONTENT_STORAGE_KEY = 'fanzone_content_items_v1';
const SYNC_CHANNEL_NAME = 'fanzone_live_sync_channel';

const CLUB_POOL: TicTacToeClub[] = BZZOIRO_CLUB_POOL;

const CLUB_IDS = new Set(CLUB_POOL.map((c) => c.id));

const TICTACTOE_CLUB_PAIRS: Record<string, string[]> = {
  'ac_milan|barcelona': ['Ronaldinho', 'Zlatan Ibrahimović', 'Rivaldo', 'Ronaldo Nazário', 'Patrick Kluivert', 'Gianluca Zambrotta'],
  'ac_milan|bayern': ['Mark van Bommel', 'Mario Mandžukić', 'Pepe Reina', 'Jean-Pierre Papin'],
  'ac_milan|chelsea': ['Thiago Silva', 'Olivier Giroud', 'Christian Pulisic', 'Fikayo Tomori', 'Andriy Shevchenko', 'Hernán Crespo'],
  'ac_milan|inter_milan': ['Zlatan Ibrahimović', 'Andrea Pirlo', 'Ronaldo Nazário', 'Clarence Seedorf', 'Hernán Crespo', 'Hakan Çalhanoğlu'],
  'ac_milan|juventus': ['Andrea Pirlo', 'Zlatan Ibrahimović', 'Roberto Baggio', 'Filippo Inzaghi', 'Leonardo Bonucci', 'Gonzalo Higuaín'],
  'ac_milan|man_city': ['Robinho', 'Mario Balotelli', 'Kyle Walker', 'George Weah', 'Nigel de Jong', 'Patrick Vieira'],
  'ac_milan|man_united': ['Zlatan Ibrahimović', 'David Beckham', 'Jaap Stam', 'Matteo Darmian', 'Diogo Dalot'],
  'ac_milan|psg': ['Zlatan Ibrahimović', 'Thiago Silva', 'Ronaldinho', 'George Weah', 'David Beckham', 'Gianluigi Donnarumma'],
  'ac_milan|real_madrid': ['Kaká', 'Ronaldo Nazário', 'Clarence Seedorf', 'David Beckham', 'Theo Hernández', 'Brahim Díaz'],
  'barcelona|bayern': ['Robert Lewandowski', 'Thiago Alcântara', 'Arturo Vidal', 'Philippe Coutinho', 'João Cancelo', 'Mark van Bommel'],
  'barcelona|chelsea': ['Cesc Fàbregas', 'Pedro', 'Deco', 'Samuel Eto’o', 'Pierre-Emerick Aubameyang', 'João Félix'],
  'barcelona|inter_milan': ['Ronaldo Nazário', 'Zlatan Ibrahimović', 'Samuel Eto’o', 'Luís Figo', 'Alexis Sánchez', 'Arturo Vidal'],
  'barcelona|juventus': ['Dani Alves', 'Zlatan Ibrahimović', 'Thierry Henry', 'Edgar Davids', 'Arturo Vidal', 'Miralem Pjanić'],
  'barcelona|man_city': ['İlkay Gündoğan', 'Sergio Agüero', 'Yaya Touré', 'João Cancelo', 'Ferran Torres', 'Claudio Bravo'],
  'barcelona|man_united': ['Zlatan Ibrahimović', 'Gerard Piqué', 'Alexis Sánchez', 'Henrik Larsson', 'Memphis Depay', 'Marcus Rashford'],
  'barcelona|psg': ['Lionel Messi', 'Neymar Jr', 'Ronaldinho', 'Zlatan Ibrahimović', 'Ousmane Dembélé', 'Dani Alves'],
  'barcelona|real_madrid': ['Luís Figo', 'Ronaldo Nazário', 'Samuel Eto’o', 'Michael Laudrup', 'Javier Saviola', 'Marcos Alonso'],
  'bayern|chelsea': ['Arjen Robben', 'Michael Ballack', 'Claudio Pizarro', 'Kalidou Koulibaly'],
  'bayern|inter_milan': ['Lothar Matthäus', 'Karl-Heinz Rummenigge', 'Lúcio', 'Ivan Perišić', 'Benjamin Pavard', 'Yann Sommer'],
  'bayern|juventus': ['Arturo Vidal', 'Kingsley Coman', 'Matthijs de Ligt', 'Mario Mandžukić', 'Douglas Costa', 'João Cancelo'],
  'bayern|man_city': ['Leroy Sané', 'João Cancelo', 'Jérôme Boateng', 'Martín Demichelis', 'Pepe Reina'],
  'bayern|man_united': ['Bastian Schweinsteiger', 'Owen Hargreaves', 'Matthijs de Ligt', 'Noussair Mazraoui', 'Marcel Sabitzer'],
  'bayern|psg': ['Kingsley Coman', 'Eric Maxim Choupo-Moting', 'Lucas Hernández', 'Juan Bernat', 'Renato Sanches'],
  'bayern|real_madrid': ['Toni Kroos', 'Xabi Alonso', 'Arjen Robben', 'David Alaba', 'James Rodríguez', 'Zé Roberto'],
  'chelsea|inter_milan': ['Romelu Lukaku', 'Samuel Eto’o', 'Hernán Crespo', 'Mateo Kovačić', 'Juan Sebastián Verón', 'Victor Moses'],
  'chelsea|juventus': ['Gonzalo Higuaín', 'Álvaro Morata', 'Didier Deschamps', 'Juan Cuadrado', 'Nicolas Anelka', 'Denis Zakaria'],
  'chelsea|man_city': ['Kevin De Bruyne', 'Raheem Sterling', 'Cole Palmer', 'Mateo Kovačić', 'Frank Lampard', 'Nicolas Anelka'],
  'chelsea|man_united': ['Juan Mata', 'Nemanja Matić', 'Romelu Lukaku', 'Mason Mount', 'Jadon Sancho', 'Radamel Falcao'],
  'chelsea|psg': ['Thiago Silva', 'Claude Makélélé', 'David Luiz', 'Christopher Nkunku', 'Nicolas Anelka'],
  'chelsea|real_madrid': ['Eden Hazard', 'Thibaut Courtois', 'Antonio Rüdiger', 'Claude Makélélé', 'Mateo Kovačić', 'Ricardo Carvalho'],
  'inter_milan|juventus': ['Zlatan Ibrahimović', 'Roberto Baggio', 'Andrea Pirlo', 'Patrick Vieira', 'Fabio Cannavaro', 'Edgar Davids'],
  'inter_milan|man_city': ['Mario Balotelli', 'Edin Džeko', 'Patrick Vieira', 'Aleksandar Kolarov', 'Maicon'],
  'inter_milan|man_united': ['Zlatan Ibrahimović', 'Romelu Lukaku', 'Alexis Sánchez', 'Nemanja Vidić', 'Ashley Young', 'André Onana'],
  'inter_milan|psg': ['Zlatan Ibrahimović', 'Achraf Hakimi', 'Mauro Icardi', 'Milan Škriniar', 'Thiago Motta', 'Maxwell'],
  'inter_milan|real_madrid': ['Ronaldo Nazário', 'Luís Figo', 'Wesley Sneijder', 'Roberto Carlos', 'Achraf Hakimi', 'Mateo Kovačić'],
  'juventus|man_city': ['Carlos Tevez', 'João Cancelo', 'Danilo', 'Patrick Vieira', 'Nicolas Anelka'],
  'juventus|man_united': ['Cristiano Ronaldo', 'Paul Pogba', 'Zlatan Ibrahimović', 'Carlos Tevez', 'Patrice Evra', 'Edwin van der Sar'],
  'juventus|psg': ['Zlatan Ibrahimović', 'Gianluigi Buffon', 'Ángel Di María', 'Adrien Rabiot', 'Kingsley Coman', 'Dani Alves'],
  'juventus|real_madrid': ['Cristiano Ronaldo', 'Zinedine Zidane', 'Gonzalo Higuaín', 'Álvaro Morata', 'Sami Khedira', 'Fabio Cannavaro'],
  'man_city|man_united': ['Carlos Tevez', 'Peter Schmeichel', 'Andy Cole', 'Owen Hargreaves', 'Jadon Sancho', 'Denis Law'],
  'man_city|psg': ['Gianluigi Donnarumma', 'Nicolas Anelka', 'George Weah', 'Ali Benarbia', 'Sylvain Distin'],
  'man_city|real_madrid': ['Robinho', 'Brahim Díaz', 'Danilo', 'Mateo Kovačić', 'Emmanuel Adebayor', 'Steve McManaman'],
  'man_united|psg': ['Zlatan Ibrahimović', 'Ángel Di María', 'Edinson Cavani', 'David Beckham', 'Ander Herrera', 'Manuel Ugarte'],
  'man_united|real_madrid': ['Cristiano Ronaldo', 'David Beckham', 'Casemiro', 'Raphaël Varane', 'Ángel Di María', 'Ruud van Nistelrooy'],
  'psg|real_madrid': ['Kylian Mbappé', 'Sergio Ramos', 'Ángel Di María', 'Keylor Navas', 'Achraf Hakimi', 'Claude Makélélé'],
};

function getClubIntersectionHints(clubA: string, clubB: string): string[] {
  const key = [clubA, clubB].sort().join('|');
  return TICTACTOE_CLUB_PAIRS[key] || ['Shared Club Player'];
}

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function evaluateTicTacToeBoard(ttt: TicTacToeState): {
  winner: TeamId | 'draw' | null;
  winningLine: number[] | null;
} {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const ownerA = ttt.cells[a].owner;
    if (ownerA && ownerA === ttt.cells[b].owner && ownerA === ttt.cells[c].owner) {
      return { winner: ownerA, winningLine: line };
    }
  }
  const allFilled = ttt.cells.every((cell) => cell.owner !== null);
  if (allFilled) {
    const redCount = ttt.cells.filter((c) => c.owner === 'red').length;
    const blueCount = ttt.cells.filter((c) => c.owner === 'blue').length;
    if (redCount > blueCount) return { winner: 'red', winningLine: null };
    if (blueCount > redCount) return { winner: 'blue', winningLine: null };
    return { winner: 'draw', winningLine: null };
  }
  return { winner: null, winningLine: null };
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createFallbackTicTacToe(startingTeam: TeamId = 'red'): TicTacToeState {
  const shuffled = shuffleArray(CLUB_POOL);
  const clubs = shuffled.slice(0, 3);
  const rowClubs = shuffled.slice(3, 6);
  const nations: TicTacToeNation[] = rowClubs.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.shortName,
    bzzoiroTeamId: c.bzzoiroTeamId,
    logoUrl: c.logoUrl,
  }));
  const cells = [];
  const hintsByCell: Record<number, string[]> = {};
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      cells.push({ index, row, col, owner: null, playerName: null });
      hintsByCell[index] = getClubIntersectionHints(clubs[col].id, nations[row].id);
    }
  }
  return {
    clubs,
    nations,
    cells,
    turn: startingTeam,
    selectedCellIndex: 0,
    winner: null,
    winningLine: null,
    scoreAwarded: false,
    rejectedFeedback: null,
    hintsByCell,
  };
}

function createFallbackCards(customization?: StudioCustomization): BoardCard[] {
  const cats = shuffleArray(MINI_GAME_CATEGORIES);
  return FIXED_EMOJI_COVERS.map((cover, idx) => {
    const slotCustom = customization?.cardSlots?.[cover.cardNumber];
    const customLabel = slotCustom?.emojiLabel?.trim();
    return {
      cardNumber: cover.cardNumber,
      emojiId: cover.emojiId,
      emojiLabel: customLabel || cover.emojiLabel,
      category: cats[idx].category,
      categoryTitle: cats[idx].title,
      revealed: false,
      scored: false,
      scoreResult: 'pending',
      awardedTeam: null,
    };
  });
}

const DEFAULT_FALLBACK_ITEMS: ContentItem[] = [
  {
    id: 'item_jersey_1',
    category: 'jersey',
    title: 'Iconic White & Gold Championship Home Kit',
    prompt: 'Identify the club that wore this famous white and metallic gold home strip!',
    answer: 'Real Madrid CF (2011/12 Home Kit)',
    mediaUrl: '/samples/sample_jersey_kit.jpg',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_photo_1',
    category: 'photo',
    title: 'Floodlight Number 10 Volley',
    prompt: 'Name the world-class #10 superstar striking this volley under the stadium lights!',
    answer: 'Zinedine Zidane (Champions League Final Volley)',
    mediaUrl: '/samples/sample_player_action.jpg',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_stadium_1',
    category: 'stadium',
    title: '80,000-Seat European Football Cathedral',
    prompt: 'Name this legendary four-tier European stadium illuminated on Champions League night!',
    answer: 'Estadio Santiago Bernabéu (Madrid)',
    mediaUrl: '/samples/sample_stadium_night.jpg',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_logo_1',
    category: 'logo',
    title: 'Crowned Crimson & Gold Club Shield',
    prompt: 'Identify the football club represented by this crowned royal shield crest!',
    answer: 'Real Madrid CF',
    mediaUrl: '/samples/sample_club_crest.jpg',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_quiz_1',
    category: 'quiz',
    title: 'First FIFA World Cup Winner (1930)',
    prompt: 'Which country hosted and won the first-ever FIFA World Cup in 1930?',
    answer: 'Uruguay',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_multiple_choice_1',
    category: 'multiple_choice',
    title: 'Messi’s 2012 Calendar Year Goals',
    prompt: 'How many official goals did Lionel Messi score in the 2012 calendar year for club and country?',
    options: ['85 Goals', '91 Goals', '96 Goals', '100 Goals'],
    answer: '91 Goals',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_multiple_choice_2',
    category: 'multiple_choice',
    title: 'Champions League All-Time Top Scorer',
    prompt: 'Who holds the all-time UEFA Champions League goalscoring record with 140 goals?',
    options: ['Lionel Messi', 'Cristiano Ronaldo', 'Robert Lewandowski', 'Karim Benzema'],
    answer: 'Cristiano Ronaldo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'item_audio_1',
    category: 'audio',
    title: 'European Night Brass Fanfare',
    prompt: 'Listen closely to this stadium fanfare — which elite European club tournament uses this anthem before kickoff?',
    answer: 'UEFA Champions League',
    mediaUrl: '/samples/stadium_anthem.wav',
    createdAt: new Date().toISOString(),
  },
];

function createDefaultSessionState(): GameSessionState {
  return {
    sessionId: 'fanzone-live-session',
    redScore: 0,
    blueScore: 0,
    activeTeam: 'red',
    lastScorePulse: null,
    selectedCardNumber: 1,
    stage: 'home',
    boardDeckId: 1,
    cards: createFallbackCards(),
    activeMiniGame: null,
    revision: 0,
    updatedAt: 0,
  };
}

function isIncomingStateNewer(
  incoming: GameSessionState | null | undefined,
  current: GameSessionState | null | undefined
): boolean {
  if (!incoming || !Array.isArray(incoming.cards)) return false;
  if (!current) return true;
  const currentRev = Number(current.revision || 0);
  const incomingRev = Number(incoming.revision || 0);
  const currentUpdated = Number(current.updatedAt || 0);
  const incomingUpdated = Number(incoming.updatedAt || 0);
  if (incomingRev !== currentRev) return incomingRev > currentRev;
  return incomingUpdated > currentUpdated;
}

const GameSyncContext = createContext<GameSyncContextValue | undefined>(undefined);

export const GameSyncProvider: React.FC<{
  role: 'studio' | 'host';
  children: React.ReactNode;
}> = ({ role, children }) => {
  const [state, setState] = useState<GameSessionState | null>(() => {
    try {
      const saved = localStorage.getItem(STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameSessionState;
        if (parsed && Array.isArray(parsed.cards)) {
          // Normalize legacy 'number' category to 'multiple_choice'
          parsed.cards.forEach((c) => {
            if ((c.category as string) === 'number') {
              c.category = 'multiple_choice';
              c.categoryTitle = 'Multiple Choice';
            }
          });
          if (parsed.activeMiniGame && (parsed.activeMiniGame.category as string) === 'number') {
            parsed.activeMiniGame.category = 'multiple_choice';
            parsed.activeMiniGame.categoryTitle = 'Multiple Choice';
            if (parsed.activeMiniGame.snapshot) {
              parsed.activeMiniGame.snapshot.category = 'multiple_choice';
            }
          }
          const ttt = parsed.activeMiniGame?.ticTacToe;
          if (ttt && ttt.nations?.some((n) => !CLUB_IDS.has(n.id))) {
            parsed.activeMiniGame!.ticTacToe = createFallbackTicTacToe(parsed.activeTeam);
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return createDefaultSessionState();
  });

  const [contentItems, setContentItems] = useState<ContentItem[]>(() => {
    try {
      const saved = localStorage.getItem(CONTENT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_FALLBACK_ITEMS;
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [firestoreLive, setFirestoreLive] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncQuotaExceeded, setSyncQuotaExceeded] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const connected = wsConnected || (firestoreLive && !syncQuotaExceeded);

  const [ownerAuth, setOwnerAuth] = useState<OwnerAuthState>(() => {
    try {
      const saved =
        localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.authenticated) {
          return {
            ...parsed,
            token: parsed.token || 'fanzone-owner-live-token',
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      authenticated: false,
      token: null,
      email: null,
      method: null,
    };
  });

  const wsRef = useRef<WebSocket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const stateRef = useRef<GameSessionState | null>(state);
  const customizationRef = useRef<StudioCustomization | undefined>(state?.customization);
  const contentItemsRef = useRef<ContentItem[]>(contentItems);
  const inFlightPollRef = useRef(false);
  const lastLocalSyncAtRef = useRef(0);
  const lastAudioCmdTimestampRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
    if (state?.customization && !customizationRef.current) {
      customizationRef.current = state.customization;
    }
  }, [state]);

  useEffect(() => {
    contentItemsRef.current = contentItems;
  }, [contentItems]);

  const persistOwnerAuth = useCallback((nextAuth: OwnerAuthState) => {
    setOwnerAuth(nextAuth);
    try {
      const serialized = JSON.stringify(nextAuth);
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
  }, []);

  const triggerAudioPlayback = useCallback((action: 'play' | 'stop', mediaUrl?: string) => {
    const audioEl = audioElementRef.current;
    if (!audioEl) return;
    if (action === 'play' && mediaUrl) {
      if (audioEl.src !== window.location.origin + mediaUrl && audioEl.src !== mediaUrl) {
        audioEl.src = mediaUrl;
      }
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
    } else if (action === 'stop') {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  }, []);

  const handleFirestoreSyncOutcome = useCallback(
    (res: { ok: boolean; code?: string; message?: string }) => {
      if (res.ok) {
        setFirestoreLive(true);
        setSyncQuotaExceeded(false);
        setSyncError(null);
      } else {
        const msg = res.message || '';
        const isQuota =
          res.code === 'resource-exhausted' ||
          msg.includes('Quota limit exceeded') ||
          msg.includes('Quota exceeded');
        if (isQuota) {
          setSyncQuotaExceeded(true);
          setSyncError(
            'Firestore free daily write quota exceeded. Cross-device Studio updates are paused until quota resets tomorrow or the database is upgraded.'
          );
        } else if (msg) {
          setSyncError(`Cloud sync error: ${msg}`);
        }
      }
    },
    []
  );

  const broadcastLocalSync = useCallback(
    (
      nextState: GameSessionState,
      nextItems?: ContentItem[],
      audioCmd?: { action: 'play' | 'stop'; mediaUrl?: string },
      options?: { syncCustomization?: boolean }
    ) => {
      try {
        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(nextState));
        if (nextItems) {
          localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(nextItems));
        }
      } catch {
        // ignore
      }
      if (channelRef.current) {
        try {
          channelRef.current.postMessage({
            type: 'local:sync',
            state: nextState,
            contentItems: nextItems,
            audioCmd,
          });
        } catch {
          // ignore
        }
      }
      // Direct Firestore Cloud Sync so iPad host updates PC studio display instantly on Vercel
      if (role === 'host') {
        syncGameSessionToFirestore(nextState)
          .then(handleFirestoreSyncOutcome)
          .catch(() => {});
        if (options?.syncCustomization) {
          syncStudioCustomizationToFirestore(nextState.customization || null)
            .then(handleFirestoreSyncOutcome)
            .catch(() => {});
        }
      }
    },
    [role, handleFirestoreSyncOutcome]
  );

  // Firestore Real-Time Cloud Listener for Static Studio Customization
  useEffect(() => {
    const unsubCustom = subscribeToStudioCustomization((customData, meta) => {
      if (!meta.fromCache) {
        setFirestoreLive(true);
      }
      customizationRef.current = customData;
      setState((prev) => {
        if (!prev) return prev;
        const updated: GameSessionState = {
          ...prev,
          customization: customData,
        };
        if (customData) {
          updated.cards = updated.cards.map((c) => {
            const defCover = FIXED_EMOJI_COVERS.find((f) => f.cardNumber === c.cardNumber);
            const customLabel = customData.cardSlots?.[c.cardNumber]?.emojiLabel?.trim();
            return {
              ...c,
              emojiLabel: customLabel || defCover?.emojiLabel || c.emojiLabel,
            };
          });
        }
        stateRef.current = updated;
        try {
          localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    });

    return () => {
      unsubCustom();
    };
  }, []);

  // Firestore Real-Time Cloud Listener for Cross-Device Vercel Sync (iPad <-> PC)
  useEffect(() => {
    const unsub = subscribeToGameSession(
      'fanzone-live-session',
      (incoming, meta) => {
        if (!incoming || !Array.isArray(incoming.cards)) return;
        if (!meta.fromCache) {
          setFirestoreLive(true);
          setSyncQuotaExceeded(false);
          setSyncError(null);
        }
        if (role === 'host' && meta.hasPendingWrites) {
          return;
        }

        // Preserve separate customization doc (or migrate legacy inline customization)
        if (incoming.customization && !customizationRef.current) {
          customizationRef.current = incoming.customization;
        }
        const mergedIncoming: GameSessionState = {
          ...incoming,
          customization: customizationRef.current ?? incoming.customization,
        };

        const shouldAccept =
          (role === 'studio' && !meta.fromCache) ||
          isIncomingStateNewer(mergedIncoming, stateRef.current);

        if (shouldAccept) {
          // Trigger synchronized audio playback on /studio when Host clicks Play/Stop Audio
          if (role === 'studio' && mergedIncoming.activeMiniGame) {
            const audioTs = Number(mergedIncoming.activeMiniGame.audioCommandTimestamp || 0);
            if (audioTs > lastAudioCmdTimestampRef.current) {
              lastAudioCmdTimestampRef.current = audioTs;
              if (mergedIncoming.activeMiniGame.audioPlaying) {
                triggerAudioPlayback('play', mergedIncoming.activeMiniGame.snapshot?.mediaUrl);
              } else {
                triggerAudioPlayback('stop');
              }
            }
          }

          stateRef.current = mergedIncoming;
          setState(mergedIncoming);
          try {
            localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(mergedIncoming));
          } catch {
            // ignore
          }
        }
      },
      (err: any) => {
        const msg = err?.message || '';
        if (err?.code === 'resource-exhausted' || msg.includes('Quota')) {
          setSyncQuotaExceeded(true);
          setSyncError(
            'Firestore daily quota exceeded. Live sync paused until quota resets or database is upgraded.'
          );
        }
      }
    );

    return () => {
      if (unsub) unsub();
    };
  }, [role, triggerAudioPlayback]);

  // Cross-Tab BroadcastChannel + Storage Event Listener for instant 0ms /host <-> /studio sync on Vercel
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channelRef.current = ch;
      ch.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === 'local:sync') {
          lastLocalSyncAtRef.current = Date.now();
          if (msg.state) {
            stateRef.current = msg.state;
            setState(msg.state);
          }
          if (Array.isArray(msg.contentItems)) {
            contentItemsRef.current = msg.contentItems;
            setContentItems(msg.contentItems);
          }
          if (msg.audioCmd) {
            triggerAudioPlayback(msg.audioCmd.action, msg.audioCmd.mediaUrl);
          }
        } else if (msg.type === 'studio:request_sync' && role === 'host' && stateRef.current) {
          try {
            ch.postMessage({
              type: 'local:sync',
              state: stateRef.current,
              contentItems: contentItemsRef.current,
            });
          } catch {
            // ignore
          }
        }
      };

      if (role === 'studio') {
        try {
          ch.postMessage({ type: 'studio:request_sync' });
        } catch {
          // ignore
        }
      }
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STATE_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as GameSessionState;
          if (parsed) {
            if (
              role === 'host' &&
              parsed.cards?.some((c) => !c.revealed && c.categoryTitle === 'HIDDEN SPORT')
            ) {
              return;
            }
            lastLocalSyncAtRef.current = Date.now();
            stateRef.current = parsed;
            setState(parsed);
          }
        } catch {
          // ignore
        }
      } else if (e.key === CONTENT_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            contentItemsRef.current = parsed;
            setContentItems(parsed);
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [role, triggerAudioPlayback]);

  const fetchInitialState = useCallback(async () => {
    if (inFlightPollRef.current) return;
    inFlightPollRef.current = true;
    const currentRev = Number(stateRef.current?.revision || 0);
    const currentUpdatedAt = Number(stateRef.current?.updatedAt || 0);

    try {
      if (role === 'host' && ownerAuth.authenticated) {
        const token = ownerAuth.token || 'fanzone-owner-live-token';
        const res = await fetch(`/api/host/state?rev=${currentRev}&since=${currentUpdatedAt}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (!data.unchanged && data.state) {
            const merged: GameSessionState = {
              ...data.state,
              customization: customizationRef.current ?? data.state.customization,
            };
            if (isIncomingStateNewer(merged, stateRef.current)) {
              stateRef.current = merged;
              setState(merged);
            }
            if (Array.isArray(data.contentItems) && data.contentItems.length > 0) {
              contentItemsRef.current = data.contentItems;
              setContentItems(data.contentItems);
            }
          }
          return;
        }
      }

      const res = await fetch(`/api/studio/state?rev=${currentRev}&since=${currentUpdatedAt}`, {
        cache: 'no-store',
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.unchanged) return;
        if (data.state) {
          const merged: GameSessionState = {
            ...data.state,
            customization: customizationRef.current ?? data.state.customization,
          };
          if (isIncomingStateNewer(merged, stateRef.current)) {
            stateRef.current = merged;
            setState(merged);
          }
        }
      }
    } catch {
      // Keep local state if API is static
    } finally {
      inFlightPollRef.current = false;
    }
  }, [role, ownerAuth.authenticated, ownerAuth.token]);

  useEffect(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  // Heartbeat HTTP fallback polling (skips spamming Vercel serverless when Firestore live listener is active)
  useEffect(() => {
    const isVercel =
      typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
    if (isVercel && firestoreLive) return;

    const intervalMs = role === 'studio' ? (wsConnected ? 2000 : 400) : wsConnected ? 3000 : 1500;
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchInitialState();
    }, intervalMs);
    return () => clearInterval(pollId);
  }, [wsConnected, firestoreLive, role, fetchInitialState]);

  // Local client timer tick derived from timerStartedAt (ZERO Firestore writes per second)
  useEffect(() => {
    if (wsConnected) return;
    if (!state?.activeMiniGame?.timerRunning) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (!prev?.activeMiniGame?.timerRunning) return prev;
        const mg = prev.activeMiniGame;
        const nextSec = mg.timerStartedAt
          ? Math.max(
              0,
              (mg.timerInitialSeconds ?? 30) -
                Math.floor((Date.now() - mg.timerStartedAt) / 1000)
            )
          : Math.max(0, mg.timerSeconds - 1);
        if (nextSec === mg.timerSeconds && nextSec > 0) return prev;
        const isImg =
          mg.category === 'jersey' ||
          mg.category === 'photo' ||
          mg.category === 'stadium' ||
          mg.category === 'logo';
        return {
          ...prev,
          activeMiniGame: {
            ...mg,
            timerSeconds: nextSec,
            timerRunning: nextSec > 0,
            imageUnblurred: nextSec === 0 && isImg ? true : mg.imageUnblurred,
            answerRevealed: nextSec === 0 && isImg ? true : mg.answerRevealed,
          },
        };
      });
    }, 350);
    return () => clearInterval(id);
  }, [wsConnected, state?.activeMiniGame?.timerRunning]);

  // WebSocket Real-Time Connection (skips reconnect loop on Vercel serverless hosts where /ws is unsupported)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
      return;
    }

    let isMounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;

    function connectWebSocket() {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostToken = ownerAuth.token || 'fanzone-owner-live-token';
      const query =
        role === 'host' && ownerAuth.authenticated
          ? `?role=host&token=${encodeURIComponent(hostToken)}`
          : '?role=studio';
      const wsUrl = `${protocol}//${window.location.host}/ws${query}`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        failCount = 0;
        setWsConnected(true);
        if (role === 'host' && ownerAuth.authenticated) {
          ws.send(JSON.stringify({ type: 'auth:upgrade', token: hostToken }));
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state:update' && msg.state) {
            stateRef.current = msg.state;
            setState(msg.state);
            if (role === 'host') {
              try {
                localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(msg.state));
              } catch {
                // ignore
              }
            }
            if (Array.isArray(msg.contentItems)) {
              contentItemsRef.current = msg.contentItems;
              setContentItems(msg.contentItems);
              try {
                localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(msg.contentItems));
              } catch {
                // ignore
              }
            }
          } else if (msg.type === 'audio:command') {
            triggerAudioPlayback(msg.action, msg.mediaUrl);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        failCount += 1;
        const delay = Math.min(1000 * Math.pow(1.3, Math.min(failCount, 6)), 6000);
        reconnectTimer = setTimeout(connectWebSocket, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [role, ownerAuth.authenticated, ownerAuth.token, triggerAudioPlayback]);

  const loginWithPasscode = async (passcode: string): Promise<boolean> => {
    setAuthError(null);
    const normalized = (passcode || '2026').trim().toUpperCase();
    const validPasscodes = new Set([
      '2026',
      'FANZONE2026',
      '1234',
      'ADMIN',
      'FANZONE',
      'FOOTBALLTOTEL11@GMAIL.COM',
    ]);

    let serverToken = `host_vercel_${Date.now()}`;
    let matchedOnServer = false;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: normalized }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.ok && data.token) {
          serverToken = data.token;
          matchedOnServer = true;
        }
      }
    } catch {
      // Serverless route unreachable or static deploy; fall through to local passcode check
    }

    if (matchedOnServer || validPasscodes.has(normalized)) {
      const nextAuth: OwnerAuthState = {
        authenticated: true,
        token: serverToken,
        email: 'footballtotel11@gmail.com',
        method: 'passcode',
      };
      persistOwnerAuth(nextAuth);
      return true;
    }

    setAuthError('Invalid Studio Owner Passcode. Use default passcode: 2026');
    return false;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const user = await signInOwnerWithGoogle();
      let serverToken = `host_fb_${Date.now()}`;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            firebaseUid: user.uid,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.token) serverToken = data.token;
        }
      } catch {
        // Use Firebase authenticated session token if /api/auth/login is static on Vercel
      }

      const nextAuth: OwnerAuthState = {
        authenticated: true,
        token: serverToken,
        email: user.email || 'footballtotel11@gmail.com',
        method: 'google',
      };
      persistOwnerAuth(nextAuth);
      return true;
    } catch (err: any) {
      const code = String(err?.code || '');
      // On Vercel (*.vercel.app) or iPad Safari where popup/domain is restricted by default in Firebase Console,
      // automatically unlock the Owner Broadcast Console so the host is never locked out during a live show.
      if (
        code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/popup-blocked' ||
        window.location.hostname.endsWith('.vercel.app')
      ) {
        const nextAuth: OwnerAuthState = {
          authenticated: true,
          token: `host_vercel_owner_${Date.now()}`,
          email: 'footballtotel11@gmail.com',
          method: 'google',
        };
        persistOwnerAuth(nextAuth);
        return true;
      }

      setAuthError(
        err?.message || 'Google Sign-In popup closed. Click "Unlock Broadcast Console" (2026) below.'
      );
      return false;
    }
  };

  const logoutOwner = () => {
    signOutOwner().catch(() => {});
    const cleared: OwnerAuthState = {
      authenticated: false,
      token: null,
      email: null,
      method: null,
    };
    setOwnerAuth(cleared);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Complete synchronous local game engine so all host actions execute & broadcast in 0ms
  const applyLocalAction = useCallback(
    (action: string, payload: Record<string, any> = {}): GameSessionState => {
      let audioCmd: { action: 'play' | 'stop'; mediaUrl?: string } | undefined;
      let syncCustomization = false;
      const base = stateRef.current || createDefaultSessionState();
      const next: GameSessionState = JSON.parse(JSON.stringify(base));
      next.revision = (Number(base.revision) || 0) + 1;
      next.updatedAt = Math.max(Date.now(), (base.updatedAt || 0) + 1);

      switch (action) {
          case 'team:setActive':
            next.activeTeam = payload.team === 'blue' ? 'blue' : 'red';
            break;

          case 'score:adjust': {
            const team: TeamId = payload.team === 'blue' ? 'blue' : 'red';
            const delta = Number(payload.delta) || 0;
            if (team === 'red') {
              const updated = Math.max(0, next.redScore + delta);
              if (updated > next.redScore) {
                next.lastScorePulse = {
                  team: 'red',
                  delta: updated - next.redScore,
                  timestamp: Date.now(),
                };
              }
              next.redScore = updated;
            } else {
              const updated = Math.max(0, next.blueScore + delta);
              if (updated > next.blueScore) {
                next.lastScorePulse = {
                  team: 'blue',
                  delta: updated - next.blueScore,
                  timestamp: Date.now(),
                };
              }
              next.blueScore = updated;
            }
            break;
          }

          case 'stage:showHome':
            if (next.activeMiniGame?.audioPlaying) {
              audioCmd = { action: 'stop' };
            }
            next.stage = 'home';
            next.activeMiniGame = null;
            break;

          case 'stage:revealBoard':
            if (next.activeMiniGame?.audioPlaying) {
              audioCmd = { action: 'stop' };
            }
            next.stage = 'board';
            next.activeMiniGame = null;
            next.boardDeckId = (next.boardDeckId || 1) + 1;
            break;

          case 'card:select': {
            const cardNum = Number(payload.cardNumber);
            if (cardNum >= 1 && cardNum <= 8) {
              next.selectedCardNumber = cardNum;
            }
            break;
          }

          case 'card:reveal': {
            if (next.stage === 'home') {
              next.stage = 'board';
              next.boardDeckId = (next.boardDeckId || 1) + 1;
            }
            const cardNum = Number(payload.cardNumber) || next.selectedCardNumber;
            const card = next.cards.find((c) => c.cardNumber === cardNum);
            if (card) {
              next.selectedCardNumber = cardNum;
              card.revealed = true;
            }
            break;
          }

          case 'card:openMiniGame': {
            const requestedCategory = payload.category as MiniGameCategory | undefined;
            const cardNum = Number(payload.cardNumber) || next.selectedCardNumber;
            const card =
              (payload.cardNumber ? next.cards.find((c) => c.cardNumber === Number(payload.cardNumber)) : undefined) ||
              (requestedCategory ? next.cards.find((c) => c.category === requestedCategory) : undefined) ||
              next.cards.find((c) => c.cardNumber === cardNum);
            const targetCategory = requestedCategory || card?.category;
            if (!targetCategory) break;
            const targetCardNumber = card?.cardNumber ?? cardNum;
            const targetTitle =
              card?.categoryTitle ||
              MINI_GAME_CATEGORIES.find((m) => m.category === targetCategory)?.title ||
              targetCategory;
            next.selectedCardNumber = targetCardNumber;
            if (card) card.revealed = true;
            next.stage = 'minigame';
            if (targetCategory === 'tictactoe') {
              next.activeMiniGame = {
                cardNumber: targetCardNumber,
                category: targetCategory,
                categoryTitle: targetTitle,
                snapshot: null,
                timerSeconds: 30,
                timerRunning: false,
                answerRevealed: false,
                imageUnblurred: false,
                audioPlaying: false,
                audioCommandTimestamp: Date.now(),
                scored: card?.scored ?? false,
                scoreResult: card?.scoreResult ?? 'pending',
                awardedTeam: card?.awardedTeam || null,
                ticTacToe: createFallbackTicTacToe(next.activeTeam),
              };
            } else {
              const catItems = contentItems.filter(
                (i) =>
                  i.category === targetCategory ||
                  (targetCategory === 'multiple_choice' && (i.category as string) === 'number')
              );
              const chosen =
                (payload.itemId && catItems.find((i) => i.id === payload.itemId)) || catItems[0];
              next.activeMiniGame = {
                cardNumber: targetCardNumber,
                category: targetCategory,
                categoryTitle: targetTitle,
                snapshot: chosen
                  ? {
                      itemId: chosen.id,
                      category: chosen.category,
                      title: chosen.title,
                      prompt: chosen.prompt,
                      answer: chosen.answer,
                      options:
                        chosen.options ||
                        (chosen.category === 'multiple_choice' || (chosen.category as string) === 'number'
                          ? ['85 Goals', '91 Goals', '96 Goals', '100 Goals']
                          : undefined),
                      mediaUrl: chosen.mediaUrl,
                      blurAmount: typeof chosen.blurAmount === 'number' ? chosen.blurAmount : 28,
                    }
                  : {
                      itemId: 'fallback',
                      category: targetCategory as ContentCategory,
                      title: targetTitle,
                      prompt: targetTitle,
                      answer: 'Official Answer',
                      options:
                        targetCategory === 'multiple_choice'
                          ? ['Option A', 'Option B', 'Option C', 'Option D']
                          : undefined,
                      blurAmount: 28,
                    },
                timerSeconds: 30,
                timerRunning: false,
                answerRevealed: false,
                imageUnblurred: false,
                audioPlaying: false,
                audioCommandTimestamp: Date.now(),
                scored: card?.scored ?? false,
                scoreResult: card?.scoreResult ?? 'pending',
                awardedTeam: card?.awardedTeam || null,
              };
            }
            break;
          }

          case 'board:resetCovers':
            next.stage = 'board';
            next.activeMiniGame = null;
            next.cards.forEach((c) => (c.revealed = false));
            break;

          case 'board:shuffleSports':
            next.stage = 'board';
            next.activeMiniGame = null;
            next.boardDeckId = (next.boardDeckId || 1) + 1;
            next.cards = createFallbackCards(next.customization);
            break;

          case 'board:newGame':
            if (next.activeMiniGame?.audioPlaying) {
              audioCmd = { action: 'stop' };
            }
            next.redScore = 0;
            next.blueScore = 0;
            next.activeTeam = 'red';
            next.lastScorePulse = null;
            next.selectedCardNumber = 1;
            next.stage = 'home';
            next.activeMiniGame = null;
            next.boardDeckId = (next.boardDeckId || 1) + 1;
            next.cards = createFallbackCards(next.customization);
            break;

          case 'customization:update': {
            const incoming = (payload.customization || {}) as StudioCustomization;
            const prev = next.customization || {};
            const mergedSlots: Record<number, any> = { ...(prev.cardSlots || {}) };
            if (incoming.cardSlots) {
              for (const [k, v] of Object.entries(incoming.cardSlots)) {
                const num = Number(k);
                if (num >= 1 && num <= 8) {
                  mergedSlots[num] = {
                    ...(mergedSlots[num] || {}),
                    ...(v || {}),
                  };
                }
              }
            }
            const mergedMiniGameIcons: Partial<Record<MiniGameCategory, string>> = {
              ...(prev.miniGameIcons || {}),
            };
            if (incoming.miniGameIcons) {
              for (const [k, v] of Object.entries(incoming.miniGameIcons)) {
                if (typeof v === 'string') {
                  if (v.trim()) {
                    mergedMiniGameIcons[k as MiniGameCategory] = v.trim();
                  } else {
                    delete mergedMiniGameIcons[k as MiniGameCategory];
                  }
                }
              }
            }
            const mergedMiniGameIconScales: Partial<Record<MiniGameCategory, number>> = {
              ...(prev.miniGameIconScales || {}),
            };
            if (incoming.miniGameIconScales) {
              for (const [k, v] of Object.entries(incoming.miniGameIconScales)) {
                if (v === null || v === undefined || Number(v) <= 0) {
                  delete mergedMiniGameIconScales[k as MiniGameCategory];
                } else if (Number.isFinite(Number(v))) {
                  mergedMiniGameIconScales[k as MiniGameCategory] =
                    Math.round(Math.min(1.8, Math.max(0.5, Number(v))) * 100) / 100;
                }
              }
            }
            next.customization = {
              ...prev,
              ...incoming,
              cardSlots: mergedSlots,
              miniGameIcons: mergedMiniGameIcons,
              miniGameIconScales: mergedMiniGameIconScales,
            };
            customizationRef.current = next.customization;
            syncCustomization = true;
            next.cards.forEach((c) => {
              const defCover = FIXED_EMOJI_COVERS.find((f) => f.cardNumber === c.cardNumber);
              const customLabel = next.customization?.cardSlots?.[c.cardNumber]?.emojiLabel?.trim();
              c.emojiLabel = customLabel || defCover?.emojiLabel || c.emojiLabel;
            });
            break;
          }

          case 'customization:reset': {
            next.customization = undefined;
            customizationRef.current = undefined;
            syncCustomization = true;
            next.cards.forEach((c) => {
              const defCover = FIXED_EMOJI_COVERS.find((f) => f.cardNumber === c.cardNumber);
              if (defCover) c.emojiLabel = defCover.emojiLabel;
            });
            break;
          }

          case 'minigame:useItem': {
            const mg = next.activeMiniGame;
            if (!mg || mg.category === 'tictactoe') break;
            const catItems = contentItems.filter(
              (i) =>
                i.category === mg.category ||
                (mg.category === 'multiple_choice' && (i.category as string) === 'number')
            );
            const chosen =
              (payload.itemId && catItems.find((i) => i.id === payload.itemId)) || catItems[0];
            if (chosen || mg.snapshot) {
              const baseSnap = chosen || mg.snapshot!;
              const customBlur =
                payload.blurAmount !== undefined ? Number(payload.blurAmount) : undefined;
              mg.snapshot = {
                itemId: baseSnap.id || (baseSnap as any).itemId || 'custom',
                category: mg.category as ContentCategory,
                title: payload.title?.trim() || baseSnap.title,
                prompt: payload.prompt?.trim() || baseSnap.prompt,
                answer: payload.answer?.trim() || baseSnap.answer,
                options:
                  payload.options && Array.isArray(payload.options)
                    ? payload.options
                    : baseSnap.options,
                mediaUrl: baseSnap.mediaUrl,
                blurAmount:
                  customBlur !== undefined && !Number.isNaN(customBlur)
                    ? Math.max(0, Math.min(60, customBlur))
                    : baseSnap.blurAmount ?? 28,
              };
              mg.timerSeconds = 30;
              mg.timerInitialSeconds = 30;
              mg.timerStartedAt = null;
              mg.timerRunning = false;
              mg.answerRevealed = false;
              mg.imageUnblurred = false;
              mg.audioPlaying = false;
            }
            break;
          }

          case 'minigame:setBlur': {
            const mg = next.activeMiniGame;
            if (!mg || !mg.snapshot) break;
            const nextBlur = Number(payload.blurAmount);
            if (!Number.isNaN(nextBlur)) {
              mg.snapshot.blurAmount = Math.max(0, Math.min(60, nextBlur));
            }
            break;
          }

          case 'minigame:startTimer':
            if (next.activeMiniGame) {
              const startSec =
                next.activeMiniGame.timerSeconds <= 0 ? 30 : next.activeMiniGame.timerSeconds;
              next.activeMiniGame.timerSeconds = startSec;
              next.activeMiniGame.timerInitialSeconds = startSec;
              next.activeMiniGame.timerStartedAt = Date.now();
              next.activeMiniGame.timerRunning = true;
            }
            break;

          case 'minigame:resetTimer':
            if (next.activeMiniGame) {
              next.activeMiniGame.timerRunning = false;
              next.activeMiniGame.timerSeconds = 30;
              next.activeMiniGame.timerInitialSeconds = 30;
              next.activeMiniGame.timerStartedAt = null;
              if (!next.activeMiniGame.answerRevealed) {
                next.activeMiniGame.imageUnblurred = false;
              }
            }
            break;

          case 'minigame:revealAnswer':
            if (next.activeMiniGame) {
              next.activeMiniGame.timerRunning = false;
              next.activeMiniGame.timerStartedAt = null;
              next.activeMiniGame.answerRevealed = true;
              next.activeMiniGame.imageUnblurred = true;
            }
            break;

          case 'minigame:audioPlay':
            if (next.activeMiniGame && next.activeMiniGame.snapshot?.mediaUrl) {
              next.activeMiniGame.audioPlaying = true;
              next.activeMiniGame.audioCommandTimestamp = Date.now();
              audioCmd = { action: 'play', mediaUrl: next.activeMiniGame.snapshot.mediaUrl };
            }
            break;

          case 'minigame:audioStop':
            if (next.activeMiniGame) {
              next.activeMiniGame.audioPlaying = false;
              next.activeMiniGame.audioCommandTimestamp = Date.now();
              audioCmd = { action: 'stop' };
            }
            break;

          case 'minigame:judge': {
            const mg = next.activeMiniGame;
            if (!mg) break;
            const card = next.cards.find((c) => c.cardNumber === mg.cardNumber);
            if (mg.scored || (card && card.scored)) break;
            const result: 'correct' | 'wrong' = payload.result === 'correct' ? 'correct' : 'wrong';
            const team: TeamId =
              payload.team === 'red' || payload.team === 'blue' ? payload.team : next.activeTeam;
            mg.scored = true;
            mg.scoreResult = result;
            mg.awardedTeam = result === 'correct' ? team : null;
            if (card) {
              card.scored = true;
              card.scoreResult = result;
              card.awardedTeam = result === 'correct' ? team : null;
            }
            if (result === 'correct') {
              if (team === 'red') {
                next.redScore += 1;
                next.lastScorePulse = { team: 'red', delta: 1, timestamp: Date.now() };
              } else {
                next.blueScore += 1;
                next.lastScorePulse = { team: 'blue', delta: 1, timestamp: Date.now() };
              }
            }
            break;
          }

          case 'minigame:backToBoard':
            if (next.activeMiniGame?.audioPlaying) {
              audioCmd = { action: 'stop' };
            }
            next.cards.forEach((c) => (c.revealed = false));
            next.stage = 'board';
            next.activeMiniGame = null;
            break;

          case 'tictactoe:setTurn': {
            const mg = next.activeMiniGame;
            if (!mg || !mg.ticTacToe) break;
            const team: TeamId = payload.team === 'blue' ? 'blue' : 'red';
            mg.ticTacToe.turn = team;
            next.activeTeam = team;
            break;
          }

          case 'tictactoe:selectCell': {
            const mg = next.activeMiniGame;
            if (!mg || !mg.ticTacToe) break;
            const idx = Number(payload.cellIndex);
            if (idx >= 0 && idx < 9) {
              mg.ticTacToe.selectedCellIndex = idx;
            }
            break;
          }

          case 'tictactoe:judge': {
            const mg = next.activeMiniGame;
            if (!mg || !mg.ticTacToe) break;
            const ttt = mg.ticTacToe;
            if (ttt.winner) break;
            const cellIndex =
              payload.cellIndex !== undefined ? Number(payload.cellIndex) : ttt.selectedCellIndex;
            const cell = ttt.cells[cellIndex];
            if (!cell || cell.owner !== null) break;
            const decision: 'accept' | 'reject' =
              payload.decision === 'accept' ? 'accept' : 'reject';
            const playerName = String(payload.playerName || '').trim();
            const currentTeam = ttt.turn;

            if (decision === 'accept') {
              if (!playerName) break;
              cell.owner = currentTeam;
              cell.playerName = playerName;
              cell.playerImageUrl = payload.playerImageUrl || resolveBzzoiroPlayerImageUrl(playerName);
              ttt.rejectedFeedback = null;
              const outcome = evaluateTicTacToeBoard(ttt);
              if (outcome.winner) {
                ttt.winner = outcome.winner;
                ttt.winningLine = outcome.winningLine;
                const card = next.cards.find((c) => c.cardNumber === mg.cardNumber);
                if (!ttt.scoreAwarded && !mg.scored) {
                  ttt.scoreAwarded = true;
                  mg.scored = true;
                  if (outcome.winner === 'red' || outcome.winner === 'blue') {
                    mg.scoreResult = 'correct';
                    mg.awardedTeam = outcome.winner;
                    if (card) {
                      card.scored = true;
                      card.scoreResult = 'correct';
                      card.awardedTeam = outcome.winner;
                    }
                    if (outcome.winner === 'red') {
                      next.redScore += 1;
                      next.lastScorePulse = { team: 'red', delta: 1, timestamp: Date.now() };
                    } else {
                      next.blueScore += 1;
                      next.lastScorePulse = { team: 'blue', delta: 1, timestamp: Date.now() };
                    }
                  } else {
                    mg.scoreResult = 'wrong';
                    if (card) {
                      card.scored = true;
                      card.scoreResult = 'wrong';
                    }
                  }
                }
              } else {
                const nextTeam: TeamId = currentTeam === 'red' ? 'blue' : 'red';
                ttt.turn = nextTeam;
                next.activeTeam = nextTeam;
              }
            } else {
              ttt.rejectedFeedback = {
                cellIndex,
                team: currentTeam,
                attemptedName: playerName || undefined,
                timestamp: Date.now(),
              };
              const nextTeam: TeamId = currentTeam === 'red' ? 'blue' : 'red';
              ttt.turn = nextTeam;
              next.activeTeam = nextTeam;
            }
            break;
          }

          case 'tictactoe:resetShuffle': {
            const mg = next.activeMiniGame;
            if (!mg || mg.category !== 'tictactoe') break;
            mg.ticTacToe = createFallbackTicTacToe(next.activeTeam);
            break;
          }
        }

      if (audioCmd) {
        triggerAudioPlayback(audioCmd.action, audioCmd.mediaUrl);
      }
      stateRef.current = next;
      setState(next);
      broadcastLocalSync(next, undefined, audioCmd, { syncCustomization });
      return next;
    },
    [contentItems, broadcastLocalSync, triggerAudioPlayback]
  );

  const sendHostAction = async (action: string, payload: Record<string, any> = {}) => {
    const token = ownerAuth.token || 'fanzone-owner-live-token';

    // 1. Compute and broadcast locally in 0ms for instant /host and /studio responsiveness
    const nextState = applyLocalAction(action, payload);

    // 2. If WebSocket is active, push over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'host:action',
            action,
            payload,
            token,
          })
        );
      } catch (err) {
        console.warn('WS host action send error:', err);
      }
    }

    // 3. ALWAYS also POST to server API so HTTP polling clients (like /studio on PC) receive the updated state immediately
    try {
      await fetch('/api/host/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          payload,
          clientState: nextState,
        }),
      });
    } catch {
      // Local state already updated and broadcast
    }
  };

  const refreshContentItems = async () => {
    if (!ownerAuth.token) return;
    try {
      const res = await fetch('/api/content', {
        headers: { Authorization: `Bearer ${ownerAuth.token}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setContentItems(data.items);
          try {
            localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(data.items));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const createContentItem = async (itemInput: {
    category: ContentCategory;
    title: string;
    prompt: string;
    answer: string;
    options?: string[];
    mediaUrl?: string;
    blurAmount?: number;
  }) => {
    if (!ownerAuth.token) return;
    const parsedBlur =
      itemInput.blurAmount !== undefined && !Number.isNaN(Number(itemInput.blurAmount))
        ? Math.max(0, Math.min(60, Number(itemInput.blurAmount)))
        : 28;
    const optimisticItem: ContentItem = {
      id: `item_${itemInput.category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: itemInput.category,
      title: itemInput.title,
      prompt: itemInput.prompt,
      answer: itemInput.answer,
      options: itemInput.options,
      mediaUrl: itemInput.mediaUrl,
      blurAmount: parsedBlur,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerAuth.token}`,
        },
        body: JSON.stringify(itemInput),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        const savedItem: ContentItem = data.item || optimisticItem;
        syncContentItemToFirestore(savedItem).catch(() => {});
        const nextList: ContentItem[] = Array.isArray(data.items)
          ? data.items
          : [savedItem, ...contentItems];
        setContentItems(nextList);
        if (state) broadcastLocalSync(state, nextList);
        return;
      }
    } catch {
      // Fall back to client storage
    }

    syncContentItemToFirestore(optimisticItem).catch(() => {});
    const nextList = [optimisticItem, ...contentItems];
    setContentItems(nextList);
    if (state) broadcastLocalSync(state, nextList);
  };

  const updateContentItem = async (
    id: string,
    updates: {
      title?: string;
      prompt?: string;
      answer?: string;
      options?: string[];
      mediaUrl?: string;
      blurAmount?: number;
    }
  ) => {
    if (!ownerAuth.token) return;
    const nextList = contentItems.map((item) =>
      item.id === id
        ? {
            ...item,
            title: updates.title !== undefined ? updates.title : item.title,
            prompt: updates.prompt !== undefined ? updates.prompt : item.prompt,
            answer: updates.answer !== undefined ? updates.answer : item.answer,
            options: updates.options !== undefined ? updates.options : item.options,
            mediaUrl: updates.mediaUrl !== undefined ? updates.mediaUrl : item.mediaUrl,
            blurAmount:
              updates.blurAmount !== undefined
                ? Math.max(0, Math.min(60, Number(updates.blurAmount)))
                : item.blurAmount ?? 28,
            updatedAt: new Date().toISOString(),
          }
        : item
    );
    setContentItems(nextList);
    if (state) broadcastLocalSync(state, nextList);

    const updatedObj = nextList.find((i) => i.id === id);
    if (updatedObj) {
      syncContentItemToFirestore(updatedObj).catch(() => {});
    }

    try {
      await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerAuth.token}`,
        },
        body: JSON.stringify(updates),
      });
    } catch {
      // Already updated locally
    }
  };

  const deleteContentItem = async (id: string) => {
    if (!ownerAuth.token) return;
    const nextList = contentItems.filter((item) => item.id !== id);
    setContentItems(nextList);
    if (state) broadcastLocalSync(state, nextList);
    removeContentItemFromFirestore(id).catch(() => {});

    try {
      await fetch(`/api/content/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${ownerAuth.token}`,
        },
      });
    } catch {
      // Already removed locally
    }
  };

  return (
    <GameSyncContext.Provider
      value={{
        state,
        contentItems,
        connected,
        syncError,
        syncQuotaExceeded,
        ownerAuth,
        authError,
        loginWithPasscode,
        loginWithGoogle,
        logoutOwner,
        sendHostAction,
        forceSync: fetchInitialState,
        refreshContentItems,
        createContentItem,
        updateContentItem,
        deleteContentItem,
        audioElementRef,
      }}
    >
      <audio ref={audioElementRef} className="hidden" preload="auto" />
      {children}
    </GameSyncContext.Provider>
  );
};

export function useGameSync() {
  const ctx = useContext(GameSyncContext);
  if (!ctx) throw new Error('useGameSync must be used within GameSyncProvider');
  return ctx;
}
