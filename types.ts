// FIX: Removed self-import of types which caused declaration conflicts.

export interface Player {
  id: string;
  name: string;
  avatar: string | null;
  isSpy: boolean;
  isEliminated: boolean;
  isHost: boolean;
  connectionStatus?: 'connected' | 'disconnected';
  roleAcknowledged?: boolean;
  readyForNextRound?: boolean;
  joinTimestamp?: any;
  firebaseAuthUid: string; // Add this line
}

export type QuestionType = 'YES_NO' | 'SCALE_4' | 'PLAYERS';
export type QuestionSource = 'library' | 'ai';

export interface Question {
  id: number;
  text: string;
  type: QuestionType;
  answers: string[];
  familyFriendly: boolean;
}

export interface Answer {
  playerId: string;
  answer: string;
}

export type GamePhase = 
  | 'LOBBY'
  | 'SETUP'
  | 'ROLE_REVEAL'
  | 'ANSWERING'
  | 'RESULTS_DISCUSSION'
  | 'VOTE_REVEAL'
  | 'SYNCING_NEXT_ROUND'
  | 'GAME_OVER';

export interface Vote {
  voterId: string;
  votedForId: string | null; // Allow null for skipped votes
}

export interface ChatMessage {
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    text: string;
    timestamp: number;
    status?: 'sending' | 'sent' | 'read';
}

// FIX: Added missing GameState interface to resolve import errors.
export interface GameState {
  roomId: string | null;
  hostId: string | null;
  players: Record<string, Player>;
  initialSpyCount: number;
  votingEnabled: boolean;
  questionSource: QuestionSource;
  familyFriendly: boolean;

  noTimer: boolean;
  roundLimit: boolean;
  showQuestionToSpy: boolean;
  anonymousVoting: boolean;
  gamePhase: GamePhase;
  round: number;
  usedQuestionIds: number[];
  usedQuestionTexts: string[];
  currentQuestion: Question | null;
  answers: Answer[];
  votes: Vote[];
  // FIX: Allow chatMessages to be a record of messages, as returned by Firebase, to fix a type error.
  chatMessages: ChatMessage[] | Record<string, ChatMessage>;
  lastEliminated: Player | null;
  winner: 'PLAYERS' | 'SPIES' | null;
  answerTimerEnd: number | null;
  voteTimerEnd: number | null;
  hideAnswerStatus: boolean;
}