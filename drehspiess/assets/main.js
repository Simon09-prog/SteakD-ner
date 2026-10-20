/* Zum Drehspieß – kleine Helfer für Navigation, Öffnungszeiten, Karte und Speisekarten-Filter */
(function () {
    // Mobile Navigation auf- und zuklappen
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.nav-toggle');
    if (header && toggle) {
        toggle.addEventListener('click', () => {
            const open = header.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
        });
        header.querySelectorAll('.nav a').forEach((link) => {
            link.addEventListener('click', () => {
                header.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // Öffnungszeiten (volle Stunden, Ortszeit Osnabrück). 0 = Sonntag
    const HOURS = { 0: [12, 22], 1: [10, 23], 2: [10, 23], 3: [10, 23], 4: [10, 23], 5: [10, 24], 6: [10, 24] };
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function berlinNow() {
        const parts = {};
        new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Berlin',
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
            hourCycle: 'h23'
        }).formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
        return {
            day: WEEKDAYS.indexOf(parts.weekday),
            minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute)
        };
    }
    const formatHour = (h) => String(h).padStart(2, '0') + ':00';

    const now = berlinNow();
    if (now.day >= 0) {
        document.querySelectorAll('.hours tr[data-day]').forEach((row) => {
            if (Number(row.dataset.day) === now.day) row.classList.add('today');
        });

        const [open, close] = HOURS[now.day];
        const isOpen = now.minutes >= open * 60 && now.minutes < close * 60;
        let text;
        if (isOpen) {
            text = 'Jetzt geöffnet · bis ' + formatHour(close) + ' Uhr';
        } else if (now.minutes < open * 60) {
            text = 'Gerade geschlossen · öffnet heute um ' + formatHour(open) + ' Uhr';
        } else {
            text = 'Gerade geschlossen · öffnet morgen um ' + formatHour(HOURS[(now.day + 1) % 7][0]) + ' Uhr';
        }
        document.querySelectorAll('[data-status]').forEach((el) => {
            el.classList.add(isOpen ? 'is-open' : 'is-closed');
            el.querySelector('[data-status-text]').textContent = text;
        });
    }

    // Google Maps erst nach Klick laden (keine Daten an Google ohne Zustimmung)
    document.querySelectorAll('[data-map-src]').forEach((map) => {
        const button = map.querySelector('button');
        if (!button) return;
        button.addEventListener('click', () => {
            const iframe = document.createElement('iframe');
            iframe.src = map.dataset.mapSrc;
            iframe.title = 'Karte: Zum Drehspieß, Große Hamkenstraße 21, Osnabrück';
            iframe.loading = 'lazy';
            iframe.allowFullscreen = true;
            map.appendChild(iframe);
            map.classList.add('loaded');
        });
    });

    // Hintergrundvideo anhalten, wenn weniger Bewegung gewünscht ist
    const video = document.querySelector('.hero-video');
    if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        video.removeAttribute('autoplay');
        video.pause();
    }

    // Sanftes Einblenden beim Scrollen
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        reveals.forEach((el) => io.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add('in'));
    }

    // Speisekarte: Filter alle / vegetarisch / vegan
    const chips = document.querySelectorAll('.chip[data-filter]');
    const FILTERS = ['alle', 'veggie', 'vegan'];
    function applyFilter(filter) {
        chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter)));
        let total = 0;
        document.querySelectorAll('.menu-cat').forEach((cat) => {
            let visible = 0;
            cat.querySelectorAll('.dish').forEach((dish) => {
                const diet = dish.dataset.diet || '';
                const show = filter === 'alle'
                    || (filter === 'vegan' && diet === 'vegan')
                    || (filter === 'veggie' && (diet === 'vegan' || diet === 'veggie'));
                dish.hidden = !show;
                if (show) visible++;
            });
            cat.hidden = visible === 0;
            total += visible;
        });
        document.querySelectorAll('.cat-nav a').forEach((link) => {
            const target = document.querySelector(link.getAttribute('href'));
            link.hidden = Boolean(target && target.hidden);
        });
        const empty = document.querySelector('.menu-empty');
        if (empty) empty.hidden = total > 0;
    }
    if (chips.length) {
        chips.forEach((chip) => chip.addEventListener('click', () => applyFilter(chip.dataset.filter)));
        const initial = new URLSearchParams(window.location.search).get('filter');
        if (FILTERS.includes(initial)) applyFilter(initial);
    }

    // Speisekarte: aktive Kategorie in der Leiste markieren
    const catNav = document.querySelector('.cat-nav');
    const catLinks = document.querySelectorAll('.cat-nav a');
    if (catNav && 'IntersectionObserver' in window) {
        const catObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                catLinks.forEach((link) => {
                    const active = link.getAttribute('href') === '#' + entry.target.id;
                    link.classList.toggle('active', active);
                    if (active) {
                        // nur die Leiste seitlich mitscrollen, nicht die Seite
                        const offset = link.getBoundingClientRect().left - catNav.getBoundingClientRect().left;
                        catNav.scrollTo({ left: catNav.scrollLeft + offset - (catNav.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
                    }
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        document.querySelectorAll('.menu-cat').forEach((cat) => catObserver.observe(cat));
    }

    // Jahreszahl im Footer
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
