import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { HostState } from '../../../shared/types';
import { formatCode, teamsLabel } from './format';

interface Props {
  state: HostState;
  disabled: boolean;
  onRemove: (teamId: string) => Promise<void>;
}

export default function Lobby({ state, disabled, onRemove }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const joinUrl = `${location.origin}/play?code=${state.code}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(joinUrl, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#090c22', light: '#ffffff' },
    })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  // A team that left (or was removed elsewhere) cannot stay "being confirmed".
  useEffect(() => {
    if (confirming && !state.teams.some((t) => t.id === confirming)) setConfirming(null);
  }, [confirming, state.teams]);

  return (
    <div className="lobby">
      <div className="lobby-join">
        <div className="lobby-text">
          <p className="eyebrow">{state.quizTitle}</p>
          <p className="lobby-step">Μπείτε από το κινητό σας στο</p>
          <p className="lobby-url">{location.host}/play</p>
          <p className="lobby-step">με τον κωδικό</p>
          <p className="lobby-code" aria-label={`Κωδικός ${state.code.split('').join(' ')}`}>
            {formatCode(state.code)}
          </p>
        </div>
        <div className="lobby-qr">
          {qr ? <img src={qr} alt="QR code για είσοδο στο παιχνίδι" /> : <div className="qr-placeholder" />}
          <span className="muted">ή σκανάρετε</span>
        </div>
      </div>

      <div className="lobby-teams">
        <p className="lobby-count">
          {state.teams.length === 0 ? 'Περιμένουμε τις ομάδες…' : `${teamsLabel(state.teams.length)} μέσα`}
        </p>
        <ul className="chips">
          {state.teams.map((t) =>
            confirming === t.id ? (
              <li key={t.id} className="chip confirming" data-nokeys>
                <span>Αφαίρεση «{t.name}»;</span>
                <button
                  type="button"
                  className="chip-yes"
                  disabled={disabled}
                  autoFocus
                  onClick={async () => {
                    await onRemove(t.id);
                    setConfirming(null);
                  }}
                >
                  Ναι
                </button>
                <button type="button" className="chip-no" onClick={() => setConfirming(null)}>
                  Όχι
                </button>
              </li>
            ) : (
              <li key={t.id} className="chip">
                <span className="chip-name">{t.name}</span>
                <button
                  type="button"
                  className="chip-x"
                  aria-label={`Αφαίρεση ομάδας ${t.name}`}
                  disabled={disabled}
                  onClick={() => setConfirming(t.id)}
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
