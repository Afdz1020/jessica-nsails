// Comportamiento de scroll: animaciones de aparición, punto activo
// de la navegación lateral y desplazamiento suave a cada sección.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initReveal() {
	const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
	els.forEach((el) => {
		const d = parseInt(el.dataset.reveal ?? '0') || 0;
		el.style.setProperty('--reveal-delay', `${d * 0.12}s`);
	});

	// Igual que el diseño: aparece al entrar y se vuelve a ocultar al salir,
	// así la animación se repite cada vez que vuelves a una sección.
	const io = new IntersectionObserver(
		(entries) => entries.forEach((e) => e.target.classList.toggle('is-visible', e.isIntersecting)),
		{ threshold: 0.15 },
	);
	els.forEach((el) => io.observe(el));
}

function initActiveSection() {
	const dots = document.querySelectorAll<HTMLAnchorElement>('[data-dot]');
	const navLinks = document.querySelectorAll<HTMLAnchorElement>('[data-nav]');

	const setActive = (id: string) => {
		dots.forEach((d) => {
			const on = d.dataset.dot === id;
			d.classList.toggle('is-active', on);
			if (on) d.setAttribute('aria-current', 'true');
			else d.removeAttribute('aria-current');
		});
		navLinks.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === id));
	};

	// Una línea en el centro del viewport: la sección que la cruza es la activa.
	// Funciona también con secciones más altas que la pantalla (p. ej. en móvil).
	const so = new IntersectionObserver(
		(entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
		{ rootMargin: '-50% 0px -50% 0px' },
	);
	document.querySelectorAll<HTMLElement>('[data-sec]').forEach((el) => so.observe(el));
}

function initSmoothLinks() {
	document.addEventListener('click', (e) => {
		const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
		if (!link) return;
		const id = link.getAttribute('href')!.slice(1);
		const target = id && document.getElementById(id);
		if (!target) return;
		e.preventDefault();
		target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
		history.replaceState(null, '', `#${id}`);
	});
}

export function initScroll() {
	initReveal();
	initActiveSection();
	initSmoothLinks();
}
