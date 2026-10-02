import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
    const wrappedInput = input<HTMLInputElement>('wrapped-command');
    const wrapped = wrappedInput.value.trim();
    const useClipboard = input<HTMLInputElement>('clipboard');
    input<HTMLElement>('wrap-field').hidden = mode !== 'wrap';
    useClipboard.disabled = output !== 'file';
    const invalidLines = !lineInput.checkValidity() || !Number.isSafeInteger(lines) || lines < 1;
    const invalidWrap = mode === 'wrap' && (!wrapped || /["\x27`$\r\n]/.test(wrapped));
    lineInput.setAttribute('aria-invalid', String(invalidLines));
    wrappedInput.setAttribute('aria-invalid', String(invalidWrap));
    input<HTMLFieldSetElement>('collectors').setAttribute('aria-invalid', String(!ids.length));
    const error = !ids.length ? 'Choose at least one collector.'
      : invalidLines ? 'Choose a whole number of lines from 1 to 100000.'
      : invalidWrap ? 'Use a simple command without quotes, dollar signs, backticks or line breaks. See the guide for shell-specific commands.' : '';
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

const toggle = document.querySelector<HTMLButtonElement>('#motion-toggle');
if (toggle) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let cleanup: (() => void) | undefined;
  let demo: gsap.core.Timeline | undefined;
  const setup = () => {
    cleanup?.();
    demo = undefined;
    toggle.hidden = reduced.matches;
    toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(paused));
    document.documentElement.dataset.motion = reduced.matches || paused ? 'off' : 'on';
    const replay = document.querySelector<HTMLButtonElement>('.replay-demo');
    if (replay) replay.disabled = reduced.matches || paused;
    if (reduced.matches || paused) return;
    const context = gsap.context(() => {
      gsap.from('.hero-line', { yPercent: 100, opacity: 0, stagger: .12, duration: 1, ease: 'power4.out', clearProps: 'all' });
      gsap.from('.hero-copy .lead, .hero-copy .install, .hero-links', { y: 24, opacity: 0, stagger: .1, delay: .35, duration: .8, clearProps: 'all' });
      demo = gsap.timeline({ repeat: -1, repeatDelay: 3 });
      demo.fromTo('.demo-source', { y: -25, opacity: 0 }, { y: 0, opacity: 1, duration: .6 })
        .set('.demo-phase', { textContent: 'Gather the context' }, 0)
        .fromTo('.bridge-line', { scaleX: 0 }, { scaleX: 1, duration: .6, stagger: .15 }, .4)
        .fromTo('.report-rows p', { x: 45, opacity: 0 }, { x: 0, opacity: 1, stagger: .18, duration: .55 }, .8)
        .set('.demo-phase', { textContent: 'Mask matching values' }, 1.7)
        .fromTo('.demo-mask', { opacity: 0 }, { opacity: 1, duration: .3 }, 2)
        .to('.demo-secret', { opacity: .3, duration: .4 }, 2)
        .set('.demo-phase', { textContent: 'Your report. Your review.' }, 2.8)
        .fromTo('.report-review', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .5 }, 2.8)
        .fromTo('.demo-report', { rotation: -3 }, { rotation: 0, duration: 1, ease: 'power3.out' }, 2.5);
      gsap.utils.toArray<HTMLElement>('.reveal').forEach(el => {
        gsap.from(el, { y: 50, opacity: .15, duration: .9, ease: 'power3.out', clearProps: 'all', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
      });
      const story = gsap.timeline({ scrollTrigger: { trigger: '.workflow-story', start: 'top 65%', end: 'bottom 85%', scrub: .6 } });
      story.from('.story-document', { rotation: -7, y: 65, duration: 1 })
        .from('.story-row', { x: 70, opacity: 0, stagger: .2, duration: .5 }, 0)
        .to('.story-password span', { opacity: 0, duration: .15 }, 1.35)
        .set('.story-password span', { textContent: '[redacted]' }, 1.5)
        .to('.story-password span', { opacity: 1, duration: .15 }, 1.5)
        .from('.story-stamp', { y: 25, opacity: 0, duration: .5 }, 2)
        .to('.story-document', { rotation: 3, duration: .5 }, 2);
      gsap.to('.portrait-wrap img', { yPercent: -7, ease: 'none', scrollTrigger: { trigger: '.about-section', start: 'top bottom', end: 'bottom top', scrub: .8 } });
      gsap.from('.sample-report', { rotation: 3, y: 50, ease: 'none', scrollTrigger: { trigger: '.sample-layout', start: 'top bottom', end: 'center center', scrub: .6 } });
    });
    let visible = true;
    const playState = () => demo?.paused(document.hidden || !visible);
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; playState(); });
    observer.observe(document.querySelector('.pack-stage')!);
    document.addEventListener('visibilitychange', playState);
    cleanup = () => { observer.disconnect(); document.removeEventListener('visibilitychange', playState); context.revert(); };
  };
  toggle.addEventListener('click', () => { paused = !paused; setup(); });
  document.querySelector('.replay-demo')?.addEventListener('click', () => { demo?.restart(); });
  reduced.addEventListener('change', setup);
  window.addEventListener('pagehide', () => { cleanup?.(); clearTimeout(statusTimer); });
  window.addEventListener('pageshow', event => { if (event.persisted) setup(); });
  setup();
}
