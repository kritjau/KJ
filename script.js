const html = document.documentElement;

// Boot log text for the start-up screen's side columns (systemd on the left, kernel on the right).
const ok = (s) => `<b>[  OK  ]</b> ${s}`;
const SERVICES = [
  '<i>Welcome to Arch Linux!</i>',
  ok('Created slice Slice /system/getty.'),
  ok('Started Dispatch Password Requests to Console.'),
  ok('Reached target Local Encrypted Volumes.'),
  ok('Reached target Path Units.'),
  ok('Listening on Journal Socket.'),
  ok('Started Journal Service.'),
  ok('Mounted /boot.'),
  ok('Started Load Kernel Modules.'),
  ok('Started Apply Kernel Variables.'),
  ok('Started Rule-based Manager for Device Events.'),
  ok('Reached target Local File Systems.'),
  ok('Started Network Time Synchronization.'),
  ok('Reached target System Time Set.'),
  ok('Started Network Configuration.'),
  ok('Reached target Network.'),
  ok('Started Network Name Resolution.'),
  ok('Started OpenSSH Daemon.'),
  ok('Started D-Bus System Message Bus.'),
  ok('Started Pilot Profile Service.'),
  ok('Started Loadout Calibration.'),
  ok('Started HUD Renderer.'),
  ok('Started Comms Relay.'),
  ok('Reached target Multi-User System.'),
  ok('Reached target Graphical Interface.'),
];
const KERNEL = [
  '[    0.000000] Linux version 6.10.2-arch1-1 (linux@archlinux)',
  '[    0.000000] Command line: BOOT_IMAGE=/vmlinuz-linux rw quiet',
  '[    0.000000] BIOS-provided physical RAM map:',
  '[    0.004213] DMI: pilot-kj/hud, BIOS 1.0 2026',
  '[    0.012004] x86/fpu: Supporting XSAVE feature 0x001',
  '[    0.031877] Memory: 16264312K/16671300K available',
  '[    0.104312] ACPI: Core revision 20240322',
  '[    0.118540] smpboot: CPU0: 8 cores, 16 threads',
  '[    0.231877] PCI: Using configuration type 1 for base access',
  '[    0.302991] NET: Registered PF_INET protocol family',
  '[    0.402211] usb 1-1: new high-speed USB device number 2',
  '[    0.455120] nvme nvme0: 16/0/0 default/read/poll queues',
  '[    0.498802] nvme0n1: p1 p2',
  '[    0.611032] e1000e eth0: Link is Up 1000 Mbps Full Duplex',
  '[    0.713554] EXT4-fs (nvme0n1p2): mounted filesystem r/w',
  '[    0.892341] random: crng init done',
  '[    1.004456] systemd[1]: Detected architecture x86-64.',
  '[    1.120983] systemd[1]: Hostname set to <pilot-kj>.',
  '[    1.402117] input: HUD Controller as /devices/virtual/input0',
  '[    1.588760] cdc_acm 1-2:1.0: ttyACM0: USB ACM device',
  '[    1.790321] ch341 1-3:1.0: ch341-uart converter detected',
  '[    2.013398] wlan0: associated',
  '[    2.301174] IPv6: ADDRCONF(NETDEV_CHANGE): eth0: link ready',
  '[    2.610045] comms: uplink established',
  '[    2.998214] hud: briefing ready',
];

// Start-up screen (mission briefing), first visit per session only (the check lives in <head>).
function showInit(done) {
  const init = document.createElement('div');
  init.className = 'init';
  // Screen readers get the title as a status message instead of 2s of silence; the logs, counter and bar are decoration
  // (and the counter changes 100 times), so they stay hidden from them.
  init.innerHTML = `
    <div class="boot-log" aria-hidden="true"></div>
    <div class="init-box" role="status">
      <p class="init-title">Main system</p>
      <hr class="init-rule" aria-hidden="true">
      <p class="init-sub">Mission briefing</p>
      <p class="init-load" aria-hidden="true"><span>Loading</span><span class="init-count">0</span></p>
      <div class="init-bar" aria-hidden="true"></div>
    </div>
    <div class="boot-log" aria-hidden="true"></div>`;
  document.body.append(init);

  // Each column starts already full, then streams more lines in over ~1.8s: new lines land at the bottom and push old ones up.
  // Lists repeat as needed (skipping the welcome line); kernel timestamps are renumbered so they keep counting up.
  const [left, right] = init.querySelectorAll('.boot-log');
  for (const [col, lines, kernel] of [[left, SERVICES, false], [right, KERNEL, true]]) {
    const fill = Math.ceil(col.clientHeight / parseFloat(getComputedStyle(col).lineHeight)) + 2;
    const total = fill + lines.length;
    const lineAt = (i) => {
      const line = i < lines.length ? lines[i] : lines[1 + (i % (lines.length - 1))];
      return `<p>${kernel ? line.replace(/^\[\s*[\d.]+\]/, `[${(i * 3 / total).toFixed(6).padStart(12)}]`) : line}</p>`;
    };
    for (let i = 0; i < fill; i++) col.insertAdjacentHTML('beforeend', lineAt(i));
    for (let i = fill; i < total; i++) {
      setTimeout(() => { col.insertAdjacentHTML('beforeend', lineAt(i)); col.firstElementChild.remove(); }, (i - fill + 1) * 1800 / lines.length);
    }
  }

  // loading counter, 0 to 100 in step with the bar (CSS: fill 1.5s from .3s)
  const count = init.querySelector('.init-count');
  for (let n = 1; n <= 100; n++) setTimeout(() => { count.textContent = n; }, 300 + n * 15);

  setTimeout(() => {
    html.classList.remove('initializing');
    init.classList.add('out');
    setTimeout(() => init.remove(), 300);
    done();
  }, 2000);
}

// Types text out letter by letter when it scrolls into view: the name, and every plain-text detail in the sections.
// data-delay = ms before starting, data-speed = ms per letter (default 28 for titles, 10 for details).
// No JS or reduced motion: the full text just shows.
function startTyping() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Trigger as soon as any part is on screen (15% up from the bottom edge), never at a fixed share of the element:
  // a percentage threshold never fires for things taller than the screen (high zoom, short landscape phones) and they'd stay hidden.
  const reveal = { threshold: 0, rootMargin: '0px 0px -15% 0px' };

  // Panels "lock on" when they scroll in: brackets snap to the corners, the box wipes open, the border flashes orange (style.css "Panel lock-on").
  // Panels in a row start 80ms apart; their text starts typing once the box is open.
  const pio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      pio.unobserve(e.target);
      e.target.classList.replace('lock-wait', 'lock');
      setTimeout(() => e.target.classList.remove('lock'), 1500);  // drop the finished animation's mask (cheaper, and prints normally)
    }
  }, reveal);
  document.querySelectorAll('.sec .panel').forEach((p) => {
    const i = [...p.parentElement.querySelectorAll(':scope > .panel')].indexOf(p);
    p.style.setProperty('--stagger', `${i * 80}ms`);
    p.dataset.open = i * 80 + 250;
    p.classList.add('lock-wait');
    pio.observe(p);
  });
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      const text = el.textContent;
      const out = el.querySelector('.typed');
      let i = 0;
      // typed letters + the rest hidden, so the copy always wraps exactly like the finished text (no one-line-then-jump)
      const rest = document.createElement('span');
      rest.className = 'rest';
      const tick = () => {
        rest.textContent = text.slice(++i);
        out.replaceChildren(text.slice(0, i), rest);
        if (i < text.length) setTimeout(tick, +el.dataset.speed || (el.matches('h1, h2') ? 28 : 10));
        else { out.remove(); el.classList.remove('typing'); }
      };
      setTimeout(tick, +el.dataset.delay || +el.closest('.panel')?.dataset.open || 0);
    }
  }, reveal);

  // Only plain-text leaves: no child elements (links, buttons, lang spans) and no ::before icon that the overlay would misalign with.
  // All style reads first, then all writes: interleaving them forced a style recalculation per element (~130 on load).
  const typeable = (el) => !el.children.length && el.textContent.trim() && getComputedStyle(el, '::before').content === 'none';
  const targets = [...document.querySelectorAll('.title, .sec :is(h2, h3, p, dt, dd, li)')]
    .filter(typeable)
    .map((el) => { const cs = getComputedStyle(el); return [el, cs.color, cs.textShadow]; });  // keep each element's own colour and glow while it types
  targets.forEach(([el, color, glow]) => {
    const out = document.createElement('span');
    out.className = 'typed';
    out.setAttribute('aria-hidden', 'true');
    out.style.color = color;
    out.style.textShadow = glow;
    el.classList.add('typing');
    el.append(out);
    io.observe(el);
  });
}

// If a hobby image is missing (renamed or not committed), swap it for a HUD notice instead of the browser's broken-image icon.
document.querySelectorAll('.view img').forEach((img) => {
  img.addEventListener('error', () => {
    const lost = document.createElement('p');
    lost.className = 'lost';
    lost.textContent = 'Signal lost // image unavailable';
    img.replaceWith(lost);
  }, { once: true });
});

// Cockpit parallax: feeds style.css "Motion". The grid follows the whole screen (--px/--py, -1 to 1); each card on screen
// leans toward the mouse by itself (--dx/--dy), up to 10px when the mouse is on it, fading out 600px away. Everything eases.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const goal = { x: innerWidth / 2, y: innerHeight / 2 }, now = { ...goal };
  let away = true, frame = 0;  // away: mouse outside the window (or a phone), so cards rest
  let tilted = null;  // panel under the mouse, tilted toward it (style.css: --rx/--ry, up to 3deg)
  const tilt = (p, e) => {
    if (p !== tilted) { tilted?.style.removeProperty('--rx'); tilted?.style.removeProperty('--ry'); tilted = p; }
    if (!p) return;
    const r = p.getBoundingClientRect();
    p.style.setProperty('--rx', `${((.5 - (e.clientY - r.top) / r.height) * 6).toFixed(2)}deg`);
    p.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - .5) * 6).toFixed(2)}deg`);
  };
  const lean = new Map();  // card -> its current [dx, dy]
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? lean.set(e.target, lean.get(e.target) || [0, 0]) : lean.delete(e.target))));
  document.querySelectorAll('.panel, .tx').forEach((el) => io.observe(el));

  const step = () => {
    now.x += (goal.x - now.x) * .04;
    now.y += (goal.y - now.y) * .04;
    let busy = Math.abs(goal.x - now.x) + Math.abs(goal.y - now.y) > .5;
    html.style.setProperty('--px', (now.x / innerWidth * 2 - 1).toFixed(3));
    html.style.setProperty('--py', (now.y / innerHeight * 2 - 1).toFixed(3));
    for (const [el, [dx, dy]] of lean) {
      const r = el.getBoundingClientRect();
      const vx = now.x - (r.left + r.width / 2 - dx), vy = now.y - (r.top + r.height / 2 - dy);  // from the card's resting centre
      const d = Math.hypot(vx, vy) || 1;
      const k = away ? 0 : Math.max(0, 1 - d / 275) * 10;
      const nx = dx + (vx / d * k - dx) * .06, ny = dy + (vy / d * k - dy) * .06;
      busy ||= Math.abs(nx - dx) + Math.abs(ny - dy) > .02;
      lean.set(el, [nx, ny]);
      el.style.setProperty('--dx', `${nx.toFixed(2)}px`);
      el.style.setProperty('--dy', `${ny.toFixed(2)}px`);
    }
    frame = busy ? requestAnimationFrame(step) : 0;  // sleeps once everything has settled
  };
  const wake = () => { frame ||= requestAnimationFrame(step); };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    away = false; goal.x = e.clientX; goal.y = e.clientY; wake();
    tilt(e.target.closest('.panel'), e);
  });
  document.addEventListener('mouseleave', () => { away = true; goal.x = innerWidth / 2; goal.y = innerHeight / 2; wake(); tilt(null); });
  addEventListener('scroll', wake, { passive: true });  // cards move under a still mouse
  // Phones: tilt drifts the grid only (held at ~45° = centred). ponytail: Android only; iOS needs a tap-to-allow
  // (DeviceOrientationEvent.requestPermission), add a button for it if wanted.
  addEventListener('deviceorientation', (e) => {
    if (e.gamma === null) return;
    const c = (v) => Math.max(-1, Math.min(1, v));
    goal.x = (c(e.gamma / 30) + 1) / 2 * innerWidth; goal.y = (c((e.beta - 45) / 30) + 1) / 2 * innerHeight; wake();
  });
}

// Click to target: clicking empty background (not text, cards or controls) drops a HUD lock-on marker: square brackets
// close in on the point with a coordinate readout, then fade. Decorative, so skipped with reduced motion.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const svg = (tag, attrs = {}) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest('a, button, summary, input, .panel, .tx, .site-header, h1, h2, h3, p, li, img') || getSelection().toString()) return;
    const { clientX: x, clientY: y } = e;
    const brackets = svg('path', { d: 'M-16-8V-16H-8M8-16H16V-8M16 8V16H8M-8 16H-16V8' });
    const flip = x > innerWidth - 240;  // readout goes left of the marker near the right edge
    const readout = svg('text', { x: flip ? -26 : 26, y: 4, 'text-anchor': flip ? 'end' : 'start' });
    readout.textContent = `X${Math.round(x)} Y${Math.round(y)} // No contact`;
    const marker = svg('g');
    marker.style.translate = `${x}px ${y}px`;
    marker.append(brackets, svg('circle', { r: 1.5 }), readout);
    const shot = svg('svg', { class: 'target', 'aria-hidden': 'true' });
    shot.append(marker);
    document.body.append(shot);
    brackets.animate([{ scale: 2, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2, 0, 0, 1)' });  // closes in
    readout.animate([{ opacity: 0 }, { opacity: 0, offset: .25 }, { opacity: 1, offset: .3 }], { duration: 800 });  // appears once locked
    marker.animate([{ opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 1200 }).finished.then(() => shot.remove());
  });
}

if (html.classList.contains('initializing')) showInit(startTyping);
else startTyping();

