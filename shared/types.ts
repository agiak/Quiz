export type GameStatus =
  | 'lobby'
  | 'question_open'
  | 'question_closed'
  | 'revealing'
  | 'finished'
  | 'cancelled';

export interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  /** null = use the quiz's timeLimitSec */
  timeLimitSec: number | null;
}

export interface Quiz {
  id: string;
  title: string;
  timeLimitSec: number;
  questions: Question[];
  updatedAt: string;
}

export interface RankRow {
  teamId: string;
  name: string;
  score: number;
  rank: number;
}

export interface HostState {
  role: 'host';
  gameId: string;
  status: GameStatus;
  code: string;
  quizTitle: string;
  questionCount: number;
  teams: { id: string; name: string }[];
  /** Counter incremented on every transition (used for expectStep). */
  step: number;
  serverNow: number;
  current: { index: number; text: string; options: string[]; endsAt: number } | null;
  answeredCount: number;
  reveal: {
    answers: { index: number; text: string; options: string[]; correctIndex: number }[];
    ranking: RankRow[];
    finished: boolean;
  } | null;
}

export interface TeamState {
  role: 'team';
  status: GameStatus;
  teamName: string;
  questionCount: number;
  serverNow: number;
  current: {
    index: number;
    text: string;
    options: string[];
    endsAt: number;
    myChoice: number | null;
  } | null;
  results: {
    me: RankRow;
    ranking: RankRow[];
    review: {
      index: number;
      text: string;
      options: string[];
      myChoice: number | null;
      correctIndex: number;
    }[];
  } | null;
}
