'use strict';

// Практикум №13. Hash-маршрути відкривають сторінки в одному контейнері навіть на статичному сервері.
const routes = [
    { path: '/', view: () => ({ page: 'journal', title: 'Журнал тренувань' }) },
    { path: '/workouts/:id', view: ({ id }) => ({ page: 'detail', title: 'Деталі тренування', id }) },
    { path: '/stats', view: () => ({ page: 'stats', title: 'Статистика тренувань' }) },
    { path: '/new', view: () => ({ page: 'form', title: 'Додати тренування' }) },
    { path: '/exercises', view: () => ({ page: 'api', title: 'Журнал вправ з API' }) }
];

function matchRoute(path) {
    const parts = path.split('/');
    for (const route of routes) {
        const pattern = route.path.split('/');
        const params = {};
        if (pattern.length !== parts.length) continue;
        const matches = pattern.every((part, index) => {
            if (!part.startsWith(':')) return part === parts[index];
            if (!parts[index]) return false;
            params[part.slice(1)] = parts[index];
            return true;
        });
        if (matches) return { view: route.view, params };
    }
    return null;
}

function currentView() {
    const fragment = window.location.hash.slice(1);
    const oldLinks = new Map([
        ['workout-history', '/'], ['add-workout', '/new'],
        ['workout-chart', '/stats'], ['api-journal', '/exercises']
    ]);
    const route = matchRoute(oldLinks.get(fragment) || fragment || '/');
    return route ? route.view(route.params) : { page: 'missing', title: 'Сторінку не знайдено' };
}

function navigateByLink(event) {
    const link = event.target.closest('a[data-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    window.location.hash = link.hash;
}
