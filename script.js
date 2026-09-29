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
    .map((el) => [el, getComputedStyle(el).color]);  // keep each element's own colour while it types
  targets.forEach(([el, color]) => {
    const out = document.createElement('span');
    out.className = 'typed';
    out.setAttribute('aria-hidden', 'true');
    out.style.color = color;
    el.classList.add('typing');
    el.append(out);
    io.observe(el);
  });
}

// Hobby images are linked from other sites and can vanish; swap a broken one for a HUD notice instead of the browser's broken-image icon.
document.querySelectorAll('.view img').forEach((img) => {
  img.addEventListener('error', () => {
    const lost = document.createElement('p');
    lost.className = 'lost';
    lost.textContent = 'Signal lost // image unavailable';
    img.replaceWith(lost);
  }, { once: true });
});

if (html.classList.contains('initializing')) showInit(startTyping);
else startTyping();

