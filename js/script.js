'use strict';

// Практична робота №10, варіант 19. Vue 3 обрано за HTML-шаблони й реактивність без збірки.
// Ручний renderWorkouts із практикуму №7 замінено компонентом WorkoutRow та v-for.
const API_URL = 'https://jsonplaceholder.typicode.com/todos?userId=4';

// Локальна календарна дата без зсуву через UTC.
function localDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const WorkoutRow = {
    name: 'WorkoutRow',
    props: {
        id: { type: Number, required: true },
        type: { type: String, required: true },
        minutes: { type: Number, required: true },
        calories: { type: Number, required: true },
        icon: { type: String, default: '' },
        date: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
        showDetailsLink: { type: Boolean, default: false }
    },
    emits: ['extend', 'remove'],
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
            <div class="workout-actions">
            <a v-if="showDetailsLink" :href="'#/workouts/' + id" data-link
               :aria-label="'Деталі тренування «' + type + '»'">Детальніше</a>
            <button type="button" class="extend-workout" :disabled="disabled" @click="$emit('extend', id)"
                    :aria-label="'Додати 5 хвилин до тренування «' + type + '»'">+5 хв</button>
            <button type="button" class="delete-workout" :disabled="disabled" @click="$emit('remove', id)"
                    :aria-label="'Видалити тренування «' + type + '»'">Видалити</button>
            </div>
        </article>`
};

Vue.createApp({
    name: 'WorkoutApp',
    components: { WorkoutRow, WeeklyWorkoutChart },
    data() {
        return {
            route: currentView(),
            workouts: [],
            storageReady: false,
            storageBusy: false,
            storageError: '',
            storageWarning: '',
            storageStatus: '',
            weekDate: localDateString(new Date()),
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
        selectedWorkout() {
            return this.workouts.find(workout => String(workout.id) === this.route.id);
        },
        visibleWorkouts() {
            return this.route.page === 'detail' ? (this.selectedWorkout ? [this.selectedWorkout] : []) : this.workouts;
        },
        totalCalories() {
            return this.workouts.reduce((total, workout) => total + workout.calories, 0);
        },
        totalMinutes() {
            return this.workouts.reduce((total, workout) => total + workout.duration, 0);
        },
        longestWorkout() {
            return this.workouts.reduce((longest, workout) => Math.max(longest, workout.duration), 0);
        },
        // Тиждень: понеділок включно — наступний понеділок невключно.
        weekBounds() {
            if (!this.weekDate) return null;
            const start = new Date(`${this.weekDate}T00:00:00Z`);
            if (!Number.isFinite(start.getTime())) return null;
            start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
            const end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 7);
            const sunday = new Date(end);
            sunday.setUTCDate(sunday.getUTCDate() - 1);
            return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10),
                sunday: sunday.toISOString().slice(0, 10) };
        },
        weeklyWorkoutDays() {
            return buildWeeklyWorkoutDays(this.workouts, this.weekBounds?.start);
        },
        weeklyMinutes() {
            return this.weeklyWorkoutDays.reduce((total, day) => total + day.minutes, 0);
        },
        weekLabel() {
            if (!this.weekBounds) return 'Оберіть дату для перегляду тижня.';
            const format = value => value.split('-').reverse().join('.');
            return `${format(this.weekBounds.start)} — ${format(this.weekBounds.sunday)}`;
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
        navigateByLink,
        renderRoute() {
            this.route = currentView();
            document.title = this.route.title + ' — Трекер тренувань';
            this.$nextTick(() => this.$refs.routeView.focus());
        },
        // Перший запуск: міграція; надалі джерелом списку є лише IndexedDB.
        async initializeStorage() {
            this.storageBusy = true;
            this.storageError = '';
            try {
                await WorkoutStorage.openDB();
                await WorkoutStorage.migrateFromLocalStorage([
                    { id: 1, type: 'Жим лежачи', icon: '🏋️', date: '2026-09-13', duration: 45, calories: 270 },
                    { id: 2, type: 'Пробіжка', icon: '🏃', date: '2026-09-14', duration: 120, calories: 960 }
                ]);
                await this.refreshStoredWorkouts();
                this.storageReady = true;
                this.storageStatus = 'Тренування зберігаються в цьому браузері.';
            } catch (error) {
                this.storageError = 'Не вдалося відкрити сховище тренувань. Перевірте, чи дозволено браузеру зберігати дані, закрийте інші вкладки трекера та спробуйте ще раз.';
                console.error('Помилка відкриття IndexedDB:', error);
            } finally {
                this.storageBusy = false;
            }
        },
        // Після кожної CRUD-операції перечитуємо базу та оновлюємо localStorage-копію.
        async refreshStoredWorkouts() {
            this.workouts = await WorkoutStorage.getAllItems();
            WorkoutStorage.saveToLocalStorage(this.workouts);
            this.storageWarning = WorkoutStorage.takeWarning();
        },
        async persistChange(operation, message) {
            if (!this.storageReady || this.storageBusy) return false;
            this.storageBusy = true;
            this.storageError = '';
            this.storageStatus = '';
            try {
                await operation();
                await this.refreshStoredWorkouts();
                this.storageStatus = message;
                return true;
            } catch (error) {
                this.storageError = 'Не вдалося завершити збереження. Оновіть сторінку, щоб перевірити дані, перед повторною спробою.';
                console.error('Помилка операції зі сховищем:', error);
                return false;
            } finally {
                this.storageBusy = false;
            }
        },
        // Додає час і калорії пропорційно поточному темпу; Vue оновлює картку та статистику.
        async extendWorkout(id) {
            const workout = this.workouts.find(item => item.id === id);
            if (!workout || workout.duration <= 0) return;
            const duration = workout.duration + 5;
            // Округлюємо лише відображення, щоб повторні натискання не змінювали темп.
            await this.persistChange(() => WorkoutStorage.updateItem({ ...workout, duration,
                calories: workout.calories / workout.duration * duration }), 'Тривалість і калорії оновлено.');
        },
        async removeWorkout(id) {
            const removed = await this.persistChange(() => WorkoutStorage.deleteItem(id), 'Тренування видалено.');
            if (removed && this.route.page === 'detail' && this.route.id === String(id)) window.location.hash = '/';
        },
        // Зберігаємо власну перевірку калорій із практикуму №8 через посилання Vue.
        validateCalories() {
            this.$refs.caloriesInput?.setCustomValidity(this.caloriesError);
        },
        // .prevent у шаблоні скасовує перезавантаження; картки оновлюються реактивно.
        async addWorkout(event) {
            if (!this.storageReady || this.storageBusy) return;
            this.validateCalories();
            if (!event.target.reportValidity()) return;

            const selectedType = this.workoutTypes.find(item => item.type === this.draft.type);
            if (!selectedType) return;
            const saved = await this.persistChange(() => WorkoutStorage.addItem({
                type: selectedType.type,
                icon: selectedType.icon,
                date: this.draft.date,
                duration: Number(this.draft.minutes),
                calories: Number(this.draft.calories)
            }), 'Нове тренування збережено.');
            if (!saved) return;
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
        document.title = this.route.title + ' — Трекер тренувань';
        window.addEventListener('hashchange', this.renderRoute);
        console.log('script.js підключено, Vue керує трекером тренувань.');
        this.initializeStorage();
        this.loadApiWorkouts();
    },
    beforeUnmount() {
        window.removeEventListener('hashchange', this.renderRoute);
    }
}).mount('#app');
