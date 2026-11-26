import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutationState } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Coffee,
  DoorOpen,
  FlaskConical,
  Gamepad2,
  LoaderCircle,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
  WifiOff,
} from 'lucide-react';
import { TIMETABLE_GENERATION_KEY } from '@/lib/timetableGeneration';
import './GenerationWindow.css';

function shuffleNumbers() {
  const numbers = Array.from({ length: 9 }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [numbers[index], numbers[other]] = [numbers[other], numbers[index]];
  }
  return numbers;
}

function NumberSprint() {
  const [numbers, setNumbers] = useState(shuffleNumbers);
  const [next, setNext] = useState(1);
  const [rounds, setRounds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState('Ready when you are. Start with 1.');

  function selectNumber(number: number) {
    if (number !== next) {
      setMessage(`Look for ${next} next. You have got this!`);
      return;
    }
    setNext(next + 1);
    if (number === 9) {
      setRounds((count) => count + 1);
      setMessage('Round complete! Play again for a new arrangement.');
    } else {
      setMessage(`Nice! Find ${number + 1} next.`);
    }
  }

  return (
    <section className="generation-game" aria-labelledby="generation-game-title">
      <div className="generation-game-heading">
        <span className="generation-eyebrow">
          <Gamepad2 size={16} /> A little break
        </span>
        <button
          type="button"
          className="generation-text-button"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? 'Show game' : 'Pause game'}
        </button>
      </div>
      <h2 id="generation-game-title">Number sprint</h2>
      <p className="generation-game-description">
        Tap 1 to 9 in order. A small challenge while we work.
      </p>

      <div className="generation-game-score">
        <span>
          <Trophy size={15} /> Rounds <strong>{rounds}</strong>
        </span>
        <span>
          {next > 9 ? (
            'Well played!'
          ) : (
            <>
              Next <strong>{next}</strong>
            </>
          )}
        </span>
      </div>

      {paused ? (
        <div className="generation-game-paused">
          <Coffee size={40} strokeWidth={1.4} />
          <p>Take a breath. We are on it.</p>
          <button type="button" className="generation-play-button" onClick={() => setPaused(false)}>
            <Play size={16} /> Resume game
          </button>
        </div>
      ) : (
        <>
          <div
            className="generation-number-grid"
            role="group"
            aria-label="Select the numbers from 1 to 9 in order"
          >
            {numbers.map((number) => (
              <button
                type="button"
                key={number}
                className={number < next ? 'generation-number is-found' : 'generation-number'}
                aria-label={`${number}${number < next ? ', found' : ''}`}
                aria-disabled={number < next}
                onClick={() => {
                  if (number >= next) selectNumber(number);
                }}
              >
                {number}
                {number < next && <Check size={13} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="generation-game-message" role="status">
            {message}
          </p>
          {next > 9 && (
            <button
              type="button"
              className="generation-play-button"
              onClick={() => {
                setNumbers(shuffleNumbers());
                setNext(1);
                setMessage('New round. Start with 1.');
              }}
            >
              <RotateCcw size={16} /> Play again <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
      <p className="generation-game-note">Your game ends automatically when the result is ready.</p>
    </section>
  );
}

function WaitingDialog({
  startedAt,
  paused,
  returnFocusId,
}: {
  startedAt: number;
  paused: boolean;
  returnFocusId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [now, setNow] = useState(Date.now);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const elapsedLabel = `${Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    // The native modal makes the rest of the document inert, including other portals.
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
      dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      // Wait for the initiating button to be enabled again after the mutation settles.
      requestAnimationFrame(() => {
        const target = returnFocusId ? document.getElementById(returnFocusId) : previousFocus;
        if (target instanceof HTMLElement && target.isConnected) target.focus();
      });
    };
  }, [returnFocusId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="generation-dialog"
      aria-labelledby="generation-title"
      aria-describedby="generation-description"
      aria-modal="true"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        // Do not let application shortcuts open navigation behind the modal.
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
          event.preventDefault();
        if (event.key === 'Tab') {
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (
            event.shiftKey &&
            (event.target === first || event.target === document.getElementById('generation-title'))
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && event.target === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        event.stopPropagation();
      }}
    >
      <div className="generation-window">
        <div className="generation-main">
          <div className="generation-brand">
            <CalendarDays size={20} /> SmartSched <span>WORKING ON YOUR WEEK</span>
          </div>
          <div className="generation-status-row">
            <span className="generation-status" role="status">
              {paused ? (
                <WifiOff size={15} />
              ) : (
                <LoaderCircle size={15} className="generation-spinner" />
              )}
              {paused ? 'Waiting for connection' : 'Generating timetable'}
            </span>
            <span
              className="generation-elapsed"
              aria-label={`Elapsed time: ${Math.floor(elapsed / 60)} minutes ${elapsed % 60} seconds`}
            >
              <Clock3 size={14} /> {elapsedLabel}
            </span>
          </div>

          <h1 id="generation-title" tabIndex={-1} autoFocus>
            Putting your
            <br />
            <span>week together.</span>
          </h1>
          <p id="generation-description" className="generation-description">
            We are finding available periods for your timetable. Keep this tab open; app controls
            will unlock when the request finishes.
          </p>

          <div className="generation-schedule-art" aria-hidden="true">
            <div className="generation-calendar-top">
              <span />
              <span />
              <span />
            </div>
            <div className="generation-calendar-days">
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="generation-calendar-grid">
              {Array.from({ length: 20 }, (_, index) => (
                <span
                  key={index}
                  className={`generation-calendar-cell cell-${index % 6}`}
                  style={{ animationDelay: `${index * 130}ms` }}
                >
                  {index % 4 === 0 ? (
                    <FlaskConical size={17} />
                  ) : index % 3 === 0 ? (
                    <Users size={17} />
                  ) : index % 2 === 0 ? (
                    <DoorOpen size={17} />
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="generation-considerations">
            <span>
              <DoorOpen size={14} /> Rooms & labs
            </span>
            <span>
              <Users size={14} /> Faculty availability
            </span>
          </div>
          <p className="generation-preserved">
            <ShieldCheck size={17} /> Existing timetable bookings are preserved.
          </p>
          <p className="generation-wait-note" role="status">
            {paused
              ? 'Your request is waiting for a connection. Scheduling will resume when you are online.'
              : elapsed >= 60
                ? 'Still waiting for the server. Larger timetables can take longer to schedule.'
                : 'Complex timetables can take a few minutes. Enjoy a quick break.'}
          </p>
        </div>

        <NumberSprint />

        <div className="generation-footer">
          <LockKeyhole size={14} />
          <span>App controls are temporarily locked while this request is in progress.</span>
        </div>
      </div>
    </dialog>,
    document.body
  );
}

export function GenerationWindow() {
  const pending = useMutationState({
    filters: { mutationKey: TIMETABLE_GENERATION_KEY, status: 'pending' },
    select: (mutation) => ({
      startedAt: mutation.state.submittedAt,
      paused: mutation.state.isPaused,
      returnFocusId:
        typeof mutation.options.meta?.returnFocusId === 'string'
          ? mutation.options.meta.returnFocusId
          : undefined,
    }),
  });
  if (!pending.length) return null;

  return (
    <WaitingDialog
      startedAt={pending[0].startedAt}
      paused={pending.every((request) => request.paused)}
      returnFocusId={pending[0].returnFocusId}
    />
  );
}
