import { gsap } from 'gsap';

// This entry is website-only. It never imports the collection CLI.
document.documentElement.classList.add('js-ready');
const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
const nav = document.querySelector<HTMLElement>('#navigation');
if (menu && nav) {
  menu.hidden = false;
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', event => {
    if ((event.target as Element).closest('a')) {
      menu.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      menu.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
      menu.focus();
    }
  });
}

let statusTimer: ReturnType<typeof setTimeout>;
const copyStatus = document.querySelector<HTMLElement>('#copy-status');
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copy!);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent || '');
      if (copyStatus) copyStatus.textContent = 'Copied. Review the text before using it.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (copyStatus) copyStatus.textContent = 'Clipboard unavailable. Text selected; copy it manually.';
    }
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { if (copyStatus) copyStatus.textContent = ''; }, 6000);
  });
});

const form = document.querySelector<HTMLFormElement>('#command-builder');
if (form) {
  const input = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const base = input<HTMLElement>('install-command').textContent!;
  const command = input<HTMLElement>('built-command');
  const config = input<HTMLElement>('built-config');
  const note = input<HTMLElement>('builder-note');
  const update = () => {
    const mode = input<HTMLSelectElement>('mode').value;
    const output = input<HTMLSelectElement>('output').value;
    const lineInput = input<HTMLInputElement>('lines');
    const lines = Number(lineInput.value);
    const ids = [...form.querySelectorAll<HTMLInputElement>('input[name=collector]:checked')].map(el => el.value);
    const wrapped = input<HTMLInputElement>('wrapped-command').value.trim();
    const useClipboard = input<HTMLInputElement>('clipboard');
    input<HTMLElement>('wrap-field').hidden = mode !== 'wrap';
    useClipboard.disabled = output !== 'file';
    const error = !ids.length ? 'Choose at least one collector.'
      : !lineInput.checkValidity() || !Number.isSafeInteger(lines) || lines < 1 ? 'Choose a whole number of lines from 1 to 100000.'
      : mode === 'wrap' && (!wrapped || /["\x27`$\r\n]/.test(wrapped)) ? 'Use a simple command without quotes, dollar signs, backticks or line breaks. See the guide for shell-specific commands.' : '';
    form.querySelector<HTMLInputElement>('input[name=collector]')!.setCustomValidity(ids.length ? '' : 'Choose a collector.');
    document.querySelectorAll<HTMLButtonElement>('[data-copy="built-command"], [data-copy="built-config"]').forEach(button => button.disabled = Boolean(error));
    if (error) {
      command.textContent = '# Complete the options to build a command.';
      config.textContent = '{}';
      note.textContent = error;
      return;
    }
    const args = [base];
    if (mode === 'wrap') args.push(`--wrap "${wrapped}"`);
    if (mode === 'stdin') args.push('--stdin');
    if (ids.length !== 8) args.push(`--only ${ids.join(',')}`);
    if (lines !== 200) args.push(`--lines ${lines}`);
    if (output !== 'file') args.push(`--${output}`);
    else args.push(useClipboard.checked ? '--clipboard' : '--no-clipboard');
    command.textContent = args.join(' ');
    config.textContent = JSON.stringify({ ...(ids.length !== 8 ? { only: ids } : {}), lines, clipboard: useClipboard.checked && output === 'file' }, null, 2);
    note.textContent = mode === 'stdin' ? 'Pipe your command output into this command. Example: npm test 2>&1 | ' + args.join(' ')
      : mode === 'wrap' ? 'Live child output is not redacted. A report is generated after a non-zero exit; the child may make network calls.'
      : 'Run in the project directory. Review the report before sharing. Configuration below stores collector, line and clipboard defaults only.';
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  update();
}

const stage = document.querySelector<HTMLElement>('.pack-stage');
const toggle = document.querySelector<HTMLButtonElement>('#motion-toggle');
if (stage && toggle) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pausedByUser = false;
  let visible = true;
  let stopMotion: (() => void) | undefined;
  const setup = () => {
    stopMotion?.();
    stopMotion = undefined;
    toggle.hidden = reduced.matches;
    if (reduced.matches) return;
    toggle.setAttribute('aria-pressed', String(pausedByUser));
    toggle.textContent = pausedByUser ? 'Resume motion' : 'Pause motion';
    if (pausedByUser) return;
    const animations: gsap.core.Animation[] = [];
    const context = gsap.context(() => {
      const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
      loop.set('.stage-phase', { textContent: 'COLLECT / EXAMPLE' }, 0)
        .set('.stage-count', { textContent: '01 / 03' }, 0)
        .set('.report-mini .masked', { opacity: .35 }, 0)
        .to('.slip-log', { x: 18, y: 16, rotation: -4, duration: 1.5, ease: 'power2.inOut' }, 0)
        .to('.slip-git', { x: -15, y: -12, rotation: 3, duration: 1.5, ease: 'power2.inOut' }, 0)
        .to('.report-object', { y: -10, rotationY: -10, duration: 1.5, ease: 'power2.inOut' }, 0)
        .set('.stage-phase', { textContent: 'REDACT / EXAMPLE' }, 1.5)
        .set('.stage-count', { textContent: '02 / 03' }, 1.5)
        .to('.report-mini .masked', { opacity: 1, duration: .6 }, 1.5)
        .set('.stage-phase', { textContent: 'REPORT / REVIEW' }, 2.2)
        .set('.stage-count', { textContent: '03 / 03' }, 2.2)
        .to('.slip-log', { x: 0, y: 0, rotation: -11, duration: 1.5, ease: 'power2.inOut' }, 2.2)
        .to('.slip-git', { x: 0, y: 0, rotation: 9, duration: 1.5, ease: 'power2.inOut' }, 2.2)
        .to('.report-object', { y: 0, rotationY: -18, duration: 1.5, ease: 'power2.inOut' }, 2.2);
      animations.push(loop);
    });
    const playState = () => animations.forEach(animation => animation.paused(document.hidden || !visible));
    const stageObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; playState(); });
    stageObserver.observe(stage);
    const reveals = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        // Contents are visible by default, including when JS or GSAP fails.
        context.add(() => gsap.from(entry.target, { y: 25, opacity: .35, duration: .75, ease: 'power2.out', clearProps: 'transform,opacity' }));
        reveals.unobserve(entry.target);
      }
    }, { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(el => reveals.observe(el));
    const redactObserver = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      context.add(() => {
        const demo = gsap.timeline();
        demo.to('.scan-line', { opacity: 1, left: '98%', duration: 1.3, ease: 'power1.inOut' })
          .set('.secret-example', { display: 'none' }, .65)
          .set('.redacted-example', { display: 'inline' }, .65)
          .to('.scan-line', { opacity: 0, duration: .25 });
      });
      redactObserver.disconnect();
    }, { threshold: .7 });
    const redaction = document.querySelector('.redaction-demo');
    if (redaction) redactObserver.observe(redaction);
    let frame = 0;
    const setParallax = gsap.quickSetter('.stage-grid', 'y', 'px');
    const scroll = () => {
      if (frame || document.hidden || !visible) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const distance = Math.max(-30, Math.min(30, -stage.getBoundingClientRect().top * .06));
        setParallax(distance);
      });
    };
    window.addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('visibilitychange', playState);
    playState();
    stopMotion = () => {
      stageObserver.disconnect(); reveals.disconnect(); redactObserver.disconnect();
      window.removeEventListener('scroll', scroll);
      document.removeEventListener('visibilitychange', playState);
      cancelAnimationFrame(frame);
      setParallax(0);
      context.revert();
    };
  };
  toggle.addEventListener('click', () => { pausedByUser = !pausedByUser; setup(); });
  reduced.addEventListener('change', setup);
  window.addEventListener('pagehide', () => { stopMotion?.(); clearTimeout(statusTimer); });
  window.addEventListener('pageshow', event => { if (event.persisted) setup(); });
  setup();
}
