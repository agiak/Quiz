import { z } from 'zod';
import { NAME_MAX, OPTIONS_MAX, OPTIONS_MIN, TIME_MAX_SEC, TIME_MIN_SEC } from './constants';
import { cleanTeamName } from './names';

const timeSec = z.number().int().min(TIME_MIN_SEC).max(TIME_MAX_SEC);

const questionSchema = z
  .object({
    text: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(OPTIONS_MIN).max(OPTIONS_MAX),
    correctIndex: z.number().int().min(0),
    timeLimitSec: timeSec.nullable(),
  })
  .superRefine((q, ctx) => {
    if (q.correctIndex >= q.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correctIndex'],
        message: 'correctIndex must be less than options.length',
      });
    }
  });

export const quizInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  timeLimitSec: timeSec,
  questions: z.array(questionSchema).min(1),
});

export const teamNameSchema = z
  .string()
  .transform(cleanTeamName)
  .pipe(z.string().min(1).max(NAME_MAX));

export const joinSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  name: teamNameSchema,
});

export const answerSchema = z.object({
  questionIndex: z.number().int().min(0),
  choice: z.number().int().min(0).max(3),
});

export const hostActionSchema = z.object({
  gameId: z.string().min(1),
  expectStep: z.number().int(),
});

export type QuizInput = z.infer<typeof quizInputSchema>;
export type JoinInput = z.infer<typeof joinSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
export type HostActionInput = z.infer<typeof hostActionSchema>;
