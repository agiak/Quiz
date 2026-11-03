import type { HostState } from '../../../shared/types';
import { LETTERS } from '../play/format';
import Countdown from './Countdown';

export function AnswerTiles({ options, correctIndex }: { options: string[]; correctIndex?: number }) {
  return (
    <div className={`tiles n${options.length}`}>
      {options.map((opt, i) => {
        const cls =
          correctIndex === undefined ? '' : i === correctIndex ? ' correct' : ' dim';
        return (
          <div key={i} className={`lozenge tile${cls}`}>
            <div className="in">
              <span className="k">{LETTERS[i]}</span>
              <span className="t">{opt}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuestionText({ text }: { text: string }) {
  const size = text.length > 160 ? ' long' : text.length > 90 ? ' medium' : '';
  return (
    <div className="lozenge qbox">
      <div className="in">
        <p className={`qtext${size}`}>{text}</p>
      </div>
    </div>
  );
}

export default function QuestionView({ state, offset }: { state: HostState; offset: number }) {
  const q = state.current;
  if (!q) return null;
  const closed = state.status === 'question_closed';
  return (
    <div className="qview">
      <div className="qview-head">
        <span className="qnum">
          Ερώτηση <strong>{q.index + 1}</strong> από {state.questionCount}
        </span>
        <span className="answered" aria-live="polite">
          Απάντησαν <strong>{state.answeredCount}</strong> από {state.teams.length}
        </span>
      </div>
      <div className="qview-main">
        <QuestionText text={q.text} />
        <div className="qview-timer">
          <Countdown key={q.endsAt} endsAt={q.endsAt} offset={offset} stopped={closed} />
          {closed && <p className="time-up">Ο χρόνος έληξε</p>}
        </div>
      </div>
      <AnswerTiles options={q.options} />
    </div>
  );
}
