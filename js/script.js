'use strict';

// Практична робота №10, варіант 19. Vue 3 обрано за HTML-шаблони й реактивність без збірки.
// Ручний renderWorkouts із практикуму №7 замінено компонентом WorkoutRow та v-for.
const API_URL = 'https://jsonplaceholder.typicode.com/todos?userId=4';

const WorkoutRow = {
    name: 'WorkoutRow',
    props: {
        id: { type: Number, required: true },
        type: { type: String, required: true },
        minutes: { type: Number, required: true },
        calories: { type: Number, required: true },
        icon: { type: String, default: '' },
        date: { type: String, default: '' }
    },
    emits: ['extend'],
    computed: {
        // Похідне значення залежить лише від props, окремо у стані не зберігається.
        caloriesPerMinute() {
            return this.minutes > 0 ? this.calories / this.minutes : 0;
        },
        formattedRate() {
            return this.caloriesPerMinute.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
        },
        formattedCalories() {
            return this.calories.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
        },
        isLong() {
            return this.minutes >= 60;
        },
        formattedDate() {
            return this.date.split('-').reverse().join('.');
        }
    },
    template: `
        <article class="workout-card" :class="isLong ? 'long' : 'short'"
                 :data-id="id" :data-calories="calories">
            <h3><span v-if="icon" class="workout-icon" aria-hidden="true">{{ icon }}</span> {{ type }}</h3>
            <p>{{ minutes }} хв, {{ formattedCalories }} ккал</p>
            <p class="workout-rate" aria-live="polite">Калорії за хвилину: {{ formattedRate }} ккал/хв</p>
            <p class="workout-duration-label">{{ isLong ? 'Довге тренування' : 'Коротке тренування' }}</p>
            <time v-if="date" :datetime="date">{{ formattedDate }}</time>
            <button type="button" class="extend-workout" @click="$emit('extend', id)"
                    :aria-label="'Додати 5 хвилин до тренування «' + type + '»'">+5 хв</button>
        </article>`
};

Vue.createApp({
    name: 'WorkoutApp',
    components: { WorkoutRow },
    data() {
        return {
            workouts: [
                { id: 1, type: 'Жим лежачи', icon: '🏋️', date: '2026-09-13', minutes: 45, calories: 270 },
                { id: 2, type: 'Пробіжка', icon: '🏃', date: '2026-09-14', minutes: 120, calories: 960 }
            ],
            nextWorkoutId: 3,
            workoutTypes: [
                { type: 'Жим лежачи', icon: '🏋️' },
                { type: 'Присід зі штангою', icon: '🏋️' },
                { type: 'Станова тяга', icon: '🏋️' },
                { type: 'Пробіжка', icon: '🏃' },
                { type: 'Велотренування', icon: '🚴' },
                { type: 'Плавання', icon: '🏊' },
                { type: 'Йога', icon: '🧘' }
            ],
            draft: { date: '', type: '', minutes: '', calories: '' },
            formStatus: '',
            workoutGoal: 4,
            apiWorkouts: [],
            apiLoading: false,
            apiError: '',
            apiStatus: ''
        };
    },
    computed: {
        totalCalories() {
            return this.workouts.reduce((total, workout) => total + workout.calories, 0);
        },
        totalMinutes() {
            return this.workouts.reduce((total, workout) => total + workout.minutes, 0);
        },
        longestWorkout() {
            return this.workouts.reduce((longest, workout) => Math.max(longest, workout.minutes), 0);
        },
        completedWorkouts() {
            return Math.min(this.workouts.length, this.workoutGoal);
        },
        progressPercent() {
            return Math.round(this.completedWorkouts / this.workoutGoal * 100);
        },
        caloriesError() {
            const calories = Number(this.draft.calories);
            return this.draft.calories !== '' && (calories < 1 || calories > 2000)
                ? 'Кількість калорій має бути від 1 до 2000 ккал.' : '';
        },
        caloriesPreview() {
            const minutes = Number(this.draft.minutes);
            const calories = Number(this.draft.calories);
            return Number.isInteger(minutes) && minutes > 0 && Number.isInteger(calories)
                && calories > 0 && !this.caloriesError
                ? `${(calories / minutes).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ккал/хв`
                : '—';
        }
    },
    methods: {
        // Додає час і калорії пропорційно поточному темпу; Vue оновлює картку та статистику.
        extendWorkout(id) {
            const workout = this.workouts.find(item => item.id === id);
            if (!workout || workout.minutes <= 0) return;

            const caloriesPerMinute = workout.calories / workout.minutes;
            workout.minutes += 5;
            // Округлюємо лише відображення, щоб повторні натискання не змінювали темп.
            workout.calories = caloriesPerMinute * workout.minutes;
        },
        // Зберігаємо власну перевірку калорій із практикуму №8 через посилання Vue.
        validateCalories() {
            this.$refs.caloriesInput.setCustomValidity(this.caloriesError);
        },
        // .prevent у шаблоні скасовує перезавантаження; картки оновлюються реактивно.
        addWorkout(event) {
            this.validateCalories();
            if (!event.target.reportValidity()) return;

            const selectedType = this.workoutTypes.find(item => item.type === this.draft.type);
            if (!selectedType) return;
            this.workouts.push({
                id: this.nextWorkoutId++,
                type: selectedType.type,
                icon: selectedType.icon,
                date: this.draft.date,
                minutes: Number(this.draft.minutes),
                calories: Number(this.draft.calories)
            });
            this.formStatus = `Тренування «${selectedType.type}» додано.`;
            this.draft = { date: '', type: '', minutes: '', calories: '' };
            this.validateCalories();
        },
        // Практикум №9: https://jsonplaceholder.typicode.com/todos?userId=4
        async loadApiWorkouts() {
            if (this.apiLoading) return;
            this.apiLoading = true;
            this.apiError = '';
            this.apiStatus = '';
            try {
                const response = await fetch(API_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error(`Помилка HTTP: ${response.status}`);
                const data = await response.json();
                console.log('Журнал тренувань з API:', data);
                if (!Array.isArray(data) || !data.every(item => item !== null
                    && Number.isInteger(item.id) && typeof item.title === 'string'
                    && typeof item.completed === 'boolean')) {
                    throw new Error('API повернув неочікуваний формат журналу тренувань.');
                }
                this.apiWorkouts = data;
                this.apiStatus = data.length > 0
                    ? `Завантажено вправ: ${data.length}.` : 'Журнал тренувань порожній.';
            } catch (error) {
                this.apiError = error instanceof TypeError
                    ? 'Журнал тренувань недоступний офлайн'
                    : 'Не вдалося завантажити журнал тренувань. Спробуйте ще раз.';
                console.error('Помилка завантаження журналу тренувань:', error);
            } finally {
                this.apiLoading = false;
            }
        }
    },
    mounted() {
        console.log('script.js підключено, Vue керує трекером тренувань.');
        this.loadApiWorkouts();
    }
}).mount('#app');
