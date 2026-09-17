import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowLeft,
  ArrowRight,
  CloudLightning,
  Pause,
  Plane,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type Phase = 'start' | 'playing' | 'paused' | 'over';
type Hazard = {
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  spin: number;
  kind: 'bolt' | 'debris';
};

type GameState = {
  playerX: number;
  hazards: Hazard[];
  elapsed: number;
  spawnTimer: number;
  lastTime: number;
};

const initialGameState = (): GameState => ({
  playerX: 0.5,
  hazards: [],
  elapsed: 0,
  spawnTimer: 0,
  lastTime: 0,
});

function Home() {
  const [phase, setPhase] = useState<Phase>('start');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(window.localStorage.getItem('sky-dodge-best') || 0);
    } catch {
      return 0;
    }
  });
  const [muted, setMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(initialGameState());
  const keysRef = useRef({ left: false, right: false });
  const audioRef = useRef<AudioContext | null>(null);
  const phaseRef = useRef<Phase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (muted || !audioRef.current) return;
    const context = audioRef.current;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, [muted]);

  const wakeAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    if (audioRef.current.state === 'suspended') {
      void audioRef.current.resume();
    }
  }, []);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 650;
    const context = canvas.getContext('2d');
    if (!context) return;
    const game = gameRef.current;
    context.clearRect(0, 0, width, height);

    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#102f4a');
    sky.addColorStop(0.55, '#0b2238');
    sky.addColorStop(1, '#081725');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.18;
    context.strokeStyle = '#55d6de';
    context.lineWidth = 1;
    for (let y = 0; y < height; y += 52) {
      context.beginPath();
      context.moveTo(0, y + ((game.elapsed * 12) % 52));
      context.lineTo(width, y + ((game.elapsed * 12) % 52));
      context.stroke();
    }
    for (let x = 0; x < width; x += 52) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    context.globalAlpha = 1;

    const cloudY = height * 0.15;
    context.fillStyle = 'rgba(95, 180, 194, .08)';
    for (let cloud = 0; cloud < 4; cloud += 1) {
      const cloudX = ((cloud * 0.31 + game.elapsed * 0.008) % 1.25 - 0.16) * width;
      context.beginPath();
      context.ellipse(cloudX, cloudY + (cloud % 2) * 30, width * 0.22, 22 + (cloud % 2) * 10, 0, 0, Math.PI * 2);
      context.fill();
    }

    context.strokeStyle = 'rgba(117, 215, 222, .13)';
    context.lineWidth = 2;
    for (let rain = 0; rain < 15; rain += 1) {
      const rainX = ((rain * 83 + game.elapsed * 21) % (width + 100)) - 50;
      const rainY = ((rain * 51 + game.elapsed * (28 + game.elapsed * 0.3)) % (height + 80)) - 40;
      context.beginPath();
      context.moveTo(rainX, rainY);
      context.lineTo(rainX - 9, rainY + 21);
      context.stroke();
    }

    game.hazards.forEach((hazard) => {
      const x = hazard.x * width;
      const y = hazard.y * height;
      const size = hazard.size * width;
      context.save();
      context.translate(x, y);
      context.rotate(hazard.rotation);
      if (hazard.kind === 'bolt') {
        context.fillStyle = '#f36c5d';
        context.strokeStyle = '#ffb07a';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-size * 0.25, -size);
        context.lineTo(size * 0.3, -size * 0.15);
        context.lineTo(size * 0.04, -size * 0.08);
        context.lineTo(size * 0.3, size);
        context.lineTo(-size * 0.34, size * 0.12);
        context.lineTo(-size * 0.04, size * 0.08);
        context.closePath();
        context.fill();
        context.stroke();
      } else {
        context.fillStyle = '#ed795f';
        context.strokeStyle = '#ffc079';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-size, size * 0.65);
        context.lineTo(-size * 0.55, -size * 0.68);
        context.lineTo(size * 0.35, -size);
        context.lineTo(size, -size * 0.12);
        context.lineTo(size * 0.42, size);
        context.closePath();
        context.fill();
        context.stroke();
      }
      context.restore();
    });

    const playerX = game.playerX * width;
    const playerY = height - 72;
    context.save();
    context.translate(playerX, playerY);
    context.shadowColor = 'rgba(83, 219, 227, .5)';
    context.shadowBlur = 18;
    context.fillStyle = '#f6e75f';
    context.strokeStyle = '#fff5b0';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -24);
    context.lineTo(9, 7);
    context.lineTo(25, 16);
    context.lineTo(7, 17);
    context.lineTo(0, 29);
    context.lineTo(-7, 17);
    context.lineTo(-25, 16);
    context.lineTo(-9, 7);
    context.closePath();
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = '#1b526b';
    context.beginPath();
    context.ellipse(0, -8, 4.5, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#55d6de';
    context.fillRect(-16, 17, 9, 3);
    context.fillRect(7, 17, 9, 3);
    context.restore();

    context.fillStyle = 'rgba(246, 231, 95, .32)';
    context.fillRect(0, height - 2, width * Math.min(1, game.elapsed / 45), 2);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [resizeCanvas]);

  const startGame = () => {
    wakeAudio();
    gameRef.current = initialGameState();
    setScore(0);
    setPhase('playing');
    playTone(540, 0.12, 'triangle');
  };

  const endGame = useCallback(() => {
    const finalScore = Math.floor(gameRef.current.elapsed * 10);
    setScore(finalScore);
    setBest((currentBest) => {
      const nextBest = Math.max(currentBest, finalScore);
      try {
        window.localStorage.setItem('sky-dodge-best', String(nextBest));
      } catch {
        // Local score storage is optional in restricted browser contexts.
      }
      return nextBest;
    });
    setPhase('over');
    playTone(110, 0.28, 'sawtooth');
  }, [playTone]);

  useEffect(() => {
    if (phase !== 'playing') {
      drawScene();
      return;
    }
    let frame = 0;
    gameRef.current.lastTime = 0;

    const tick = (time: number) => {
      const game = gameRef.current;
      const delta = game.lastTime ? Math.min(0.045, (time - game.lastTime) / 1000) : 0;
      game.lastTime = time;
      game.elapsed += delta;
      const direction = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      game.playerX = Math.max(0.06, Math.min(0.94, game.playerX + direction * delta * 0.84));

      const difficulty = Math.min(1, game.elapsed / 55);
      const spawnEvery = Math.max(0.3, 0.76 - difficulty * 0.32);
      game.spawnTimer += delta;
      if (game.spawnTimer >= spawnEvery) {
        game.spawnTimer = 0;
        const size = 0.026 + Math.random() * 0.017;
        game.hazards.push({
          x: 0.06 + Math.random() * 0.88,
          y: -0.06,
          size,
          speed: 0.25 + difficulty * 0.15 + Math.random() * 0.08,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 2.2,
          kind: Math.random() > 0.43 ? 'debris' : 'bolt',
        });
      }

      game.hazards.forEach((hazard) => {
        hazard.y += hazard.speed * delta;
        hazard.rotation += hazard.spin * delta;
      });

      const playerY = 0.89;
      const hit = game.hazards.some((hazard) =>
        Math.abs(hazard.x - game.playerX) < hazard.size + 0.045 &&
        Math.abs(hazard.y - playerY) < hazard.size + 0.055,
      );
      game.hazards = game.hazards.filter((hazard) => hazard.y < 1.12);
      if (hit) {
        drawScene();
        endGame();
        return;
      }

      const nextScore = Math.floor(game.elapsed * 10);
      setScore((currentScore) => currentScore === nextScore ? currentScore : nextScore);
      drawScene();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drawScene, endGame, phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowleft', 'a'].includes(key)) {
        event.preventDefault();
        keysRef.current.left = true;
      }
      if (['arrowright', 'd'].includes(key)) {
        event.preventDefault();
        keysRef.current.right = true;
      }
      if ((key === 'p' || key === ' ') && (phaseRef.current === 'playing' || phaseRef.current === 'paused')) {
        event.preventDefault();
        if (phaseRef.current === 'playing') {
          phaseRef.current = 'paused';
          setPhase('paused');
          playTone(240, 0.08, 'sine');
        } else {
          phaseRef.current = 'playing';
          setPhase('playing');
          playTone(420, 0.08, 'sine');
        }
      }
      if (key === 'enter' && phaseRef.current === 'over') startGame();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowleft', 'a'].includes(key)) keysRef.current.left = false;
      if (['arrowright', 'd'].includes(key)) keysRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  const togglePause = () => {
    if (phase === 'playing') {
      phaseRef.current = 'paused';
      setPhase('paused');
      playTone(240, 0.08, 'sine');
    } else if (phase === 'paused') {
      phaseRef.current = 'playing';
      setPhase('playing');
      playTone(420, 0.08, 'sine');
    }
  };

  const setControl = (control: 'left' | 'right', value: boolean) => {
    keysRef.current[control] = value;
  };

  const difficultyPercent = Math.min(100, Math.round(20 + gameRef.current.elapsed * 2.2));
  const isTouchGame = phase === 'playing' || phase === 'paused';

  return (
    <main className="sky-app">
      <div className="sky-grid" />
      <div className="sky-wrap">
        <header className="sky-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Plane size={23} strokeWidth={2.4} /></div>
            <div>
              <p className="brand-name">SKY DODGE</p>
              <p className="brand-sub">High-altitude survival run</p>
            </div>
          </div>
          <div className="header-readout"><span className="pulse-dot" /> Flight systems online</div>
        </header>

        <div className="game-layout">
          <section className="flight-card" aria-label="Sky Dodge game board">
            <canvas ref={canvasRef} className="game-canvas" aria-label="A small aircraft dodging falling storm hazards" />
            <div className="hud">
              <div className="hud-block">
                <span className="hud-label">Altitude points</span>
                <strong className="hud-value" data-testid="text-score">{String(score).padStart(4, '0')}</strong>
              </div>
              <div className="hud-block right">
                <button
                  className="hud-control"
                  type="button"
                  onClick={() => setMuted((value) => !value)}
                  aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
                  data-testid="button-toggle-sound"
                >
                  {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <span className="hud-label">Best {best}</span>
                {phase !== 'start' && phase !== 'over' && (
                  <button
                    className="hud-control"
                    type="button"
                    onClick={togglePause}
                    aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
                    data-testid="button-pause"
                  >
                    {phase === 'paused' ? <Play size={17} /> : <Pause size={17} />}
                  </button>
                )}
              </div>
            </div>
            <p className="game-help">Arrow keys / A D to steer · P or Space to pause</p>

            {phase !== 'playing' && (
              <div className="game-overlay">
                <div className="overlay-card">
                  {phase === 'start' && (
                    <>
                      <div className="kicker"><CloudLightning size={15} /> Altitude run / 01</div>
                      <h1 className="overlay-title">SKY<br />DODGE</h1>
                      <p className="overlay-copy">Ride the clear lane. Read the storm. Stay airborne as long as you can.</p>
                      <button className="primary-action" type="button" onClick={startGame} data-testid="button-start-game">
                        <Plane size={18} /> Begin flight
                      </button>
                      <p className="mobile-prompt">Use the flight controls below on touch screens</p>
                    </>
                  )}
                  {phase === 'paused' && (
                    <>
                      <div className="kicker"><Pause size={15} /> Flight held</div>
                      <h1 className="overlay-title">PAUSED</h1>
                      <p className="overlay-copy">The storm is still moving. Take a breath, then get back in the air.</p>
                      <button className="primary-action" type="button" onClick={togglePause} data-testid="button-resume-game">
                        <Play size={18} /> Resume flight
                      </button>
                      <button className="secondary-action" type="button" onClick={startGame} data-testid="button-restart-paused">
                        <RotateCcw size={15} /> Restart run
                      </button>
                    </>
                  )}
                  {phase === 'over' && (
                    <>
                      <div className="kicker"><Zap size={15} /> Storm contact</div>
                      <h1 className="overlay-title">FLIGHT<br />ENDED</h1>
                      <p className="overlay-copy">You held the line for <strong data-testid="text-final-score">{score}</strong> points. The sky will be waiting.</p>
                      <p className="overlay-score" data-testid="text-best-score">Personal best · {best} points</p>
                      <button className="primary-action" type="button" onClick={startGame} data-testid="button-restart-game">
                        <RotateCcw size={18} /> Fly again
                      </button>
                      <p className="mobile-prompt">Press Enter to restart</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {isTouchGame && (
              <div className="touch-controls" aria-label="Touch flight controls">
                <button
                  className="touch-button"
                  type="button"
                  aria-label="Steer left"
                  data-testid="button-steer-left"
                  onPointerDown={() => setControl('left', true)}
                  onPointerUp={() => setControl('left', false)}
                  onPointerCancel={() => setControl('left', false)}
                  onPointerLeave={() => setControl('left', false)}
                >
                  <ArrowLeft size={25} />
                </button>
                <button
                  className="touch-button"
                  type="button"
                  aria-label="Steer right"
                  data-testid="button-steer-right"
                  onPointerDown={() => setControl('right', true)}
                  onPointerUp={() => setControl('right', false)}
                  onPointerCancel={() => setControl('right', false)}
                  onPointerLeave={() => setControl('right', false)}
                >
                  <ArrowRight size={25} />
                </button>
              </div>
            )}
          </section>

          <aside className="side-column" aria-label="Flight information">
            <section className="info-card">
              <p className="info-kicker">Pilot briefing</p>
              <h2>Stay in the lane</h2>
              <div className="control-row">
                <span>Steer</span>
                <span className="key-cluster"><span className="key">A</span><span className="key">D</span></span>
              </div>
              <div className="control-row">
                <span>Emergency hold</span>
                <span className="key">P</span>
              </div>
              <div className="meter">
                <div className="meter-head"><span>Storm intensity</span><span data-testid="text-difficulty">{difficultyPercent}%</span></div>
                <div className="meter-track"><div className="meter-fill" style={{ transform: `scaleX(${difficultyPercent / 100})` }} /></div>
              </div>
            </section>
            <section className="info-card tip-card">
              <div className="tip-mark"><Wind size={26} /></div>
              <p className="info-kicker">Remember</p>
              <p>Hazards fall faster every few seconds. Small movements beat desperate ones.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;