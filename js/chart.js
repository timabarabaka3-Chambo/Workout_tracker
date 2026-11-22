'use strict';

// Практикум №12, варіант 19: Canvas-діаграма фактичної тривалості тренувань.
// Агрегує записи IndexedDB за датами; кілька тренувань одного дня підсумовуються.
function buildWeeklyWorkoutDays(workouts, weekStart) {
    if (!weekStart) return [];
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const days = labels.map((label, index) => {
        const date = new Date(`${weekStart}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return { label, date: date.toISOString().slice(0, 10), minutes: 0 };
    });
    for (const workout of workouts) {
        const day = days.find(item => item.date === workout.date);
        if (day && Number.isFinite(workout.duration) && workout.duration > 0) {
            day.minutes += workout.duration;
        }
    }
    return days;
}

class WorkoutChartRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.values = Array(7).fill(0);
        this.target = Array(7).fill(0);
        this.days = [];
        this.frameId = null;
    }

    // Скасовує попередній цикл: швидкі зміни даних не створюють паралельних анімацій.
    stop() {
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
    }

    finish() {
        this.stop();
        this.values = [...this.target];
        this.draw();
    }

    update(days, animate = true) {
        this.stop();
        this.days = days;
        this.target = Array.from({ length: 7 }, (_, index) => days[index]?.minutes ?? 0);
        if (!this.ctx) return;
        if (!animate || this.values.every((value, index) => value === this.target[index])) {
            this.finish();
            return;
        }
        const initial = [...this.values];
        let startedAt = null;
        // Час із requestAnimationFrame забезпечує однакову тривалість на різних екранах.
        const frame = timestamp => {
            if (startedAt === null) startedAt = timestamp;
            const progress = Math.min((timestamp - startedAt) / 650, 1);
            const eased = 1 - (1 - progress) ** 3;
            this.values = initial.map((value, index) => value + (this.target[index] - value) * eased);
            this.draw();
            if (progress < 1) this.frameId = requestAnimationFrame(frame);
            else this.frameId = null; // Після останнього кадру цикл припиняється.
        };
        this.frameId = requestAnimationFrame(frame);
    }

    // Кожний кадр починається з очищення Canvas, а стовпчики малюються fillRect у циклі.
    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        const left = 58, top = 38, bottom = height - 58;
        const plotWidth = width - left - 20;
        const plotHeight = bottom - top;
        const scaleMax = Math.max(30, Math.ceil(Math.max(...this.values, ...this.target) / 30) * 30);
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.font = '16px Georgia, serif';
        ctx.lineWidth = 1;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let tick = 0; tick <= 3; tick++) {
            const value = scaleMax * tick / 3;
            const y = bottom - plotHeight * tick / 3;
            ctx.strokeStyle = '#555';
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(width - 20, y);
            ctx.stroke();
            ctx.fillStyle = '#bdbdbd';
            ctx.fillText(String(Math.round(value)), left - 10, y);
        }
        ctx.fillStyle = '#bdbdbd';
        ctx.fillText('хв', left - 10, 16);
        const slot = plotWidth / 7;
        const barWidth = slot * 0.55;
        for (let index = 0; index < 7; index++) {
            const value = this.values[index];
            const x = left + slot * (index + 0.5);
            const barHeight = value / scaleMax * plotHeight;
            ctx.fillStyle = '#ff8c00';
            ctx.fillRect(x - barWidth / 2, bottom - barHeight, barWidth, barHeight);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffb347';
            ctx.fillText(String(Math.round(value)), x, bottom - barHeight - 13);
            ctx.fillStyle = '#f5f5f5';
            ctx.fillText(this.days[index]?.label ?? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][index], x, bottom + 23);
            ctx.fillStyle = '#bdbdbd';
            const date = this.days[index]?.date;
            ctx.fillText(date ? `${date.slice(8)}.${date.slice(5, 7)}` : '', x, bottom + 44);
        }
        ctx.restore();
    }
}

const WeeklyWorkoutChart = {
    name: 'WeeklyWorkoutChart',
    props: { days: { type: Array, required: true }, weekLabel: { type: String, required: true } },
    data() {
        return { renderer: null, inView: true, canvasAvailable: true };
    },
    computed: {
        total() { return this.days.reduce((sum, day) => sum + day.minutes, 0); },
        description() {
            return `Тривалість тренувань за ${this.weekLabel}. `
                + this.days.map(day => `${day.label}: ${day.minutes} хв`).join(', ');
        }
    },
    watch: {
        days: { deep: true, handler() { this.updateChart(); } }
    },
    methods: {
        updateChart() {
            this.renderer?.update(this.days, this.inView && !document.hidden && !this.motionPreference.matches);
        },
        replay() {
            if (!this.renderer) return;
            this.renderer.stop();
            this.renderer.values = Array(7).fill(0);
            this.updateChart();
        }
    },
    mounted() {
        this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.renderer = Vue.markRaw(new WorkoutChartRenderer(this.$refs.canvas));
        this.canvasAvailable = Boolean(this.renderer.ctx);
        this.onVisibilityChange = () => { if (document.hidden) this.renderer.finish(); };
        this.onMotionChange = () => { if (this.motionPreference.matches) this.renderer.finish(); };
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.motionPreference.addEventListener('change', this.onMotionChange);
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(entries => {
                this.inView = entries[0].isIntersecting;
                if (this.inView) this.replay();
                else this.renderer.finish();
            });
            this.observer.observe(this.$refs.canvas);
        }
        this.updateChart();
    },
    // При виході з екрана/застосунку не залишаємо активних кадрів та обробників.
    beforeUnmount() {
        this.renderer?.stop();
        this.observer?.disconnect();
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.motionPreference.removeEventListener('change', this.onMotionChange);
    },
    template: `
        <div class="weekly-chart">
            <div class="chart-scroll">
                <canvas ref="canvas" id="weekly-workout-chart" width="720" height="340"
                        role="img" :aria-label="description">Дані діаграми наведено в таблиці нижче.</canvas>
            </div>
            <p v-if="!canvasAvailable" class="field-error">Браузер не підтримує Canvas. Дані доступні в таблиці нижче.</p>
            <p v-if="!days.length" class="chart-hint">Оберіть дату, щоб побачити діаграму.</p>
            <p v-else-if="total === 0" class="chart-hint">За цей тиждень ще немає тренувань.</p>
            <p v-else class="chart-total" aria-live="polite">За тиждень: <strong>{{ total }} хв</strong></p>
            <button type="button" @click="replay" :disabled="!total || !canvasAvailable">Повторити анімацію</button>
            <details class="chart-data">
                <summary>Дані за днями</summary>
                <table>
                    <caption>Тривалість тренувань: {{ weekLabel }}</caption>
                    <thead><tr><th scope="col">День</th><th scope="col">Дата</th><th scope="col">Хвилини</th></tr></thead>
                    <tbody><tr v-for="day in days" :key="day.date"><th scope="row">{{ day.label }}</th><td>{{ day.date.split('-').reverse().join('.') }}</td><td>{{ day.minutes }}</td></tr></tbody>
                </table>
            </details>
        </div>`
};
