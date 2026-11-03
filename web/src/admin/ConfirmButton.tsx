import { useState } from 'react';

interface Props {
  label: string;
  question: string;
  yes: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

/** A button that asks for confirmation in place (never window.confirm). */
export default function ConfirmButton({ label, question, yes, onConfirm, disabled }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="secondary small danger" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span className="confirm-q">{question}</span>
      <button
        type="button"
        className="small danger-solid"
        disabled={busy}
        autoFocus
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
      >
        {yes}
      </button>
      <button type="button" className="secondary small" disabled={busy} onClick={() => setAsking(false)}>
        Όχι
      </button>
    </span>
  );
}
