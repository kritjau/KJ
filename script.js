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

// Mission 02 simulation: a small Asteroids in the site's HUD colours (the real one is Pygame, on GitHub).
// Runs only while its popup is open. Keys: arrows or W/A/D to fly, Space to fire, Enter to retry, Esc closes.
const sim = document.getElementById('m02-sim');
if (sim) {
  const cv = sim.querySelector('canvas'), g = cv.getContext('2d');
  const W = cv.width, H = cv.height, dpr = devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);  // sharp on high-DPI screens, game still works in 800x500
  const css = getComputedStyle(html), col = (v) => css.getPropertyValue(v).trim();
  const C = { hud: col('--hud'), accent: col('--accent'), text: col('--text'), muted: col('--muted') };
  const R = [0, 12, 22, 40], POINTS = [0, 100, 50, 20];  // per rock size 1-3: radius, score
  const keys = new Set();
  let ship, rocks, shots, score, lives, wave, over, last, frame = 0;

  const wrap = (o) => { o.x = (o.x + W) % W; o.y = (o.y + H) % H; };
  const newShip = () => ({ x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, safe: 2, cool: 0 });  // safe: seconds of spawn shield
  const rock = (x, y, size) => {
    const a = Math.random() * Math.PI * 2, v = 30 + (3 - size) * 35 + wave * 5;
    return { x, y, size, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      pts: Array.from({ length: 9 }, (_, i) => [i / 9 * Math.PI * 2, .75 + Math.random() * .35]) };  // jagged outline
  };
  const nextWave = () => {
    wave++;
    for (let i = 0; i < 2 + wave; i++) rocks.push(rock(Math.random() * W, Math.random() < .5 ? 0 : H - 1, 3));  // from top/bottom edge, away from the ship
  };
  const reset = () => { ship = newShip(); rocks = []; shots = []; score = 0; lives = 3; wave = 0; over = false; nextWave(); };
  const held = (...ks) => ks.some((k) => keys.has(k));

  const update = (dt) => {
    if (over) { if (held('Enter')) reset(); return; }
    const s = ship;
    s.a += (held('ArrowRight', 'd') - held('ArrowLeft', 'a')) * 4 * dt;
    s.thrust = held('ArrowUp', 'w');
    if (s.thrust) { s.vx += Math.cos(s.a) * 260 * dt; s.vy += Math.sin(s.a) * 260 * dt; }
    s.vx *= 1 - .5 * dt; s.vy *= 1 - .5 * dt;  // drag, so it drifts to a stop
    s.x += s.vx * dt; s.y += s.vy * dt; wrap(s);
    s.safe -= dt; s.cool -= dt;
    if (held(' ') && s.cool <= 0) {
      shots.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: s.vx + Math.cos(s.a) * 480, vy: s.vy + Math.sin(s.a) * 480, life: .9 });
      s.cool = .2;
    }
    for (const o of [...shots, ...rocks]) { o.x += o.vx * dt; o.y += o.vy * dt; wrap(o); }
    shots = shots.filter((b) => (b.life -= dt) > 0);
    for (const b of shots) {
      const hit = rocks.find((r) => Math.hypot(r.x - b.x, r.y - b.y) < R[r.size]);
      if (!hit) continue;
      b.life = 0; score += POINTS[hit.size];
      rocks.splice(rocks.indexOf(hit), 1);
      if (hit.size > 1) rocks.push(rock(hit.x, hit.y, hit.size - 1), rock(hit.x, hit.y, hit.size - 1));  // splits in two
    }
    shots = shots.filter((b) => b.life > 0);
    if (s.safe <= 0 && rocks.some((r) => Math.hypot(r.x - s.x, r.y - s.y) < R[r.size] + 8)) {
      if (--lives === 0) over = true; else ship = newShip();
    }
    if (!rocks.length) nextWave();
  };

  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.lineWidth = 1.5; g.lineJoin = 'round';
    g.strokeStyle = C.text;
    for (const r of rocks) {
      g.beginPath();
      for (const [a, k] of r.pts) g.lineTo(r.x + Math.cos(a) * R[r.size] * k, r.y + Math.sin(a) * R[r.size] * k);
      g.closePath(); g.stroke();
    }
    g.fillStyle = C.accent;
    for (const b of shots) g.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    const s = ship;
    if (!over && !(s.safe > 0 && Math.floor(s.safe * 8) % 2)) {  // blinks while shielded
      g.save(); g.translate(s.x, s.y); g.rotate(s.a);
      g.strokeStyle = C.hud; g.shadowColor = C.hud; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, 8); g.lineTo(-6, 0); g.lineTo(-10, -8); g.closePath(); g.stroke();
      if (s.thrust) { g.strokeStyle = C.accent; g.shadowColor = C.accent; g.beginPath(); g.moveTo(-8, 4); g.lineTo(-16 - Math.random() * 6, 0); g.lineTo(-8, -4); g.stroke(); }
      g.restore();
    }
    g.font = '600 13px ui-monospace, Consolas, monospace'; g.fillStyle = C.hud;
    g.textAlign = 'left'; g.fillText(`SCORE ${score}`, 14, 24);
    g.textAlign = 'right'; g.fillText(`WAVE ${wave} // HULL ${'■'.repeat(lives)}${'□'.repeat(3 - lives)}`, W - 14, 24);
    if (over) {
      g.textAlign = 'center'; g.fillStyle = C.accent; g.font = '800 28px ui-monospace, Consolas, monospace';
      g.fillText('MISSION FAILED', W / 2, H / 2 - 8);
      g.font = '600 13px ui-monospace, Consolas, monospace'; g.fillStyle = C.muted;
      g.fillText(`SCORE ${score} // PRESS ENTER TO RETRY`, W / 2, H / 2 + 22);
    }
  };

  const tick = (t) => { update(Math.min((t - last) / 1000, .05)); last = t; draw(); frame = requestAnimationFrame(tick); };
  sim.addEventListener('toggle', (e) => {
    if (e.newState === 'open') { reset(); last = performance.now(); frame = requestAnimationFrame(tick); }
    else { cancelAnimationFrame(frame); keys.clear(); }
  });
  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'd', 'w', 'Enter'];
  const key = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  addEventListener('keydown', (e) => {
    if (!sim.matches(':popover-open') || !GAME_KEYS.includes(key(e))) return;
    e.preventDefault();  // no page scrolling or button presses while playing
    keys.add(key(e));
  });
  addEventListener('keyup', (e) => keys.delete(key(e)));
}

// Terminal: the console in the hero (index.html .term). Commands drive the real page: fly to sections, launch the
// Mission 02 simulation, open links. Facts are read from the page, so editing index.html keeps it in sync.
// Drag it by its title bar with a mouse; double-click the bar to put it back.
const term = document.querySelector('.term');
if (term) {
  const out = term.querySelector('.term-out'), input = term.querySelector('input'), bar = term.querySelector('.term-bar');
  const print = (text, cls) => {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    out.append(p);
    out.scrollTop = out.scrollHeight;
  };
  const SECTIONS = { about: 'about', record: 'record', skills: 'skills', projects: 'projects', hobbies: 'offduty', contact: 'contact' };
  const link = (re) => [...document.links].find((a) => re.test(a.href))?.href;
  const TARGETS = { github: () => link(/github\.com\/kritjau\/?$/), asteroids: () => link(/asteroids/), plate: () => link(/THAI_ALP/i) };
  const sheet = (key) => [...document.querySelectorAll('.sheet dt')].find((d) => d.textContent.trim().toLowerCase() === key)?.nextElementSibling.textContent.trim() || '?';
  const booted = Date.now();
  const CMDS = {
    help: () => print([
      'help              this list',
      'whoami            who is flying',
      'ls                sections on this page',
      'goto <section>    fly there (cd works too)',
      'sortie            launch the Mission 02 simulation',
      'open <target>     github, asteroids or plate',
      'contact           comms channels',
      'neofetch          system info',
      'clear             clear the screen',
    ].join('\n')),
    whoami: () => print(`kj (Krit Jarupanitkul)\n${document.querySelector('.tagline').textContent.trim()}`),
    ls: () => print(Object.keys(SECTIONS).join('  ')),
    goto: (to = '') => {
      const id = SECTIONS[to.toLowerCase()];
      if (!id) return print(to ? `goto: no such section: ${to}. Try ls` : 'goto: which section? Try ls', 'err');
      print(`Moving to ${document.querySelector(`#${id} .sec-head .code`).textContent.trim()}`);
      document.getElementById(id).scrollIntoView();
    },
    sortie: () => {
      const sim = document.getElementById('m02-sim');
      if (!sim || matchMedia('(pointer: coarse)').matches) return print('sortie: the simulation needs a keyboard', 'err');
      print('Launching Mission 02 simulation...');
      sim.showPopover();
    },
    open: (what = '') => {
      const url = TARGETS[what.toLowerCase()]?.();
      if (!url) return print(`open: unknown target: ${what || '(none)'}. Try github, asteroids or plate`, 'err');
      print(`Opening ${url}`);
      open(url, '_blank', 'noopener');
    },
    contact: () => document.querySelectorAll('#contact .actions a').forEach((a) => print(a.textContent.trim())),
    neofetch: () => {
      const up = Math.floor((Date.now() - booted) / 1000);
      print([
        'kj@rubicon', '----------',
        'OS      Arch Linux x86_64',
        'Host    Rangsit University',
        'Shell   kjsh',
        `Uptime  ${Math.floor(up / 60)}m ${up % 60}s`,
        `Focus   ${sheet('focus')}`,
        `Lang    ${sheet('languages')}`,
      ].join('\n'));
    },
    clear: () => out.replaceChildren(),
    date: () => print(new Date().toString()),
    echo: (...words) => print(words.join(' ')),
    sudo: () => print('kj is not in the sudoers file. This incident will be reported.', 'err'),
    exit: () => print('There is no exit from the cockpit. Try goto contact.'),
  };
  CMDS.cd = CMDS.goto;

  const past = [];
  let back = 0;  // position in past while browsing with up/down
  term.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value.trim();
    input.value = '';
    print(`kj@rubicon:~$ ${line}`, 'cmd');
    if (!line) return;
    past.push(line);
    back = past.length;
    const [cmd, ...args] = line.split(/\s+/);
    (CMDS[cmd.toLowerCase()] || (() => print(`kjsh: command not found: ${cmd}. Type help.`, 'err')))(...args);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    back = Math.max(0, Math.min(past.length, back + (e.key === 'ArrowUp' ? -1 : 1)));
    input.value = past[back] ?? '';
  });
  term.addEventListener('click', (e) => { if (e.target !== bar && !getSelection().toString()) input.focus(); });

  let grab = null;  // pointer offset from the drag start
  bar.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    grab = { x: e.clientX - (parseFloat(term.style.getPropertyValue('--tx')) || 0), y: e.clientY - (parseFloat(term.style.getPropertyValue('--ty')) || 0) };
    bar.setPointerCapture(e.pointerId);
    term.classList.add('dragging');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!grab) return;
    term.style.setProperty('--tx', `${e.clientX - grab.x}px`);
    term.style.setProperty('--ty', `${e.clientY - grab.y}px`);
  });
  bar.addEventListener('lostpointercapture', () => { grab = null; term.classList.remove('dragging'); });
  bar.addEventListener('dblclick', () => { term.style.removeProperty('--tx'); term.style.removeProperty('--ty'); });
}

if (html.classList.contains('initializing')) showInit(startTyping);
else startTyping();

