import type { Question, GameStatus } from '../../../shared/types';
import type { ErrorCode } from '../../../shared/errors';

export interface GameRecord {
  id: string;
  code: string;
  quizTitle: string;
  questions: Question[];
  defaultTimeSec: number;
  status: GameStatus;
  step: number;
  currentIndex: number | null;
  questionEndsAt: number | null;
  revealStep: number | null;
  teamCountAtReveal: number | null;
}

export interface TeamRecord {
  id: string;
  name: string;
  joinedAt: number;
  removed: boolean;
}

export interface AnswerRecord {
  teamId: string;
  questionIndex: number;
  choice: number;
}

export class GameError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
    this.name = 'GameError';
  }
}
