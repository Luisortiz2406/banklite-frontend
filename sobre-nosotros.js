// =========================================================
// BANKLITE - SOBRE NOSOTROS (sobre-nosotros.html)
// =========================================================

function initAbout() {
    // Iniciales del equipo a partir de data-name
    document.querySelectorAll(".about-member").forEach(member => {
        const words = (member.dataset.name || "").trim().split(/\s+/).filter(Boolean);
        const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "B").slice(0, 2);
        const avatar = member.querySelector(".about-avatar");
        if (avatar) avatar.textContent = initials.toUpperCase();
    });

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function countUp(el) {
        const target = Number(el.dataset.count) || 0;
        const suffix = el.dataset.suffix || "";
        if (reduce) {
            el.textContent = target + suffix;
            return;
        }
        const start = performance.now();
        const duration = 1200;
        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    const counters = document.querySelectorAll("[data-count]");
    const reveals = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
        counters.forEach(countUp);
        reveals.forEach(el => el.classList.add("is-visible"));
        return;
    }

    document.body.classList.add("about-animate");

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                if (el.dataset.count !== undefined) countUp(el);
                else el.classList.add("is-visible");
                observer.unobserve(el);
            });
        },
        { threshold: 0.2 }
    );

    counters.forEach(el => observer.observe(el));
    reveals.forEach(el => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", initAbout);
