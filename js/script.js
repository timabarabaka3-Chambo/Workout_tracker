'use strict';

console.log('script.js підключено');

// Практична робота №6, варіант 19: трекер тренувань.
// Тривалість відповідає карткам на сторінці, калорії — навчальні дані.
const workouts = [
    { type: 'Жим лежачи', icon: '🏋️', date: '2026-09-13', minutes: 45, calories: 270 },
    { type: 'Пробіжка', icon: '🏃', date: '2026-09-14', minutes: 120, calories: 960 }
];

const listContainer = document.querySelector('#workouts-list');

// Видаляємо статичні приклади з HTML перед створенням динамічного списку.
const placeholders = document.querySelectorAll('#workouts-list .workout-card');
for (const placeholder of placeholders) {
    placeholder.remove();
}

// Менше 60 хвилин — коротке тренування, 60 хвилин і більше — довге.
const longWorkoutMinutes = 60;

// Повертає кількість калорій за хвилину, округлену до цілого числа.
const caloriesPerMinute = w => Math.round(w.calories / w.minutes);

// Підсумовує калорії циклом for і виводить характеристику кожного тренування.
function analyzeWorkouts(workoutList) {
    let totalCalories = 0;

    for (let i = 0; i < workoutList.length; i++) {
        const workout = workoutList[i];
        totalCalories += workout.calories;

        let durationLabel;
        if (workout.minutes < longWorkoutMinutes) {
            durationLabel = 'коротке';
        } else {
            durationLabel = 'довге';
        }

        console.log(`${workout.type}: ${workout.minutes} хв — ${durationLabel} тренування.`);
        console.log(`Спалено: ${workout.calories} ккал; за хвилину: ${caloriesPerMinute(workout)} ккал/хв.`);
    }

    console.log(`Загальна кількість спалених калорій: ${totalCalories} ккал.`);
    return totalCalories;
}

analyzeWorkouts(workouts);

// Створює картки з масиву та оновлює статистику; повторний виклик не дублює картки.
function renderWorkouts(workoutList) {
    listContainer.innerHTML = '';
    let totalCalories = 0;
    let totalMinutes = 0;
    let longestWorkout = 0;

    for (const workout of workoutList) {
        const card = document.createElement('article');
        card.classList.add('workout-card');
        card.dataset.calories = workout.calories;

        const title = document.createElement('h3');
        title.textContent = workout.type;
        if (workout.icon) {
            const icon = document.createElement('span');
            icon.classList.add('workout-icon');
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = workout.icon;
            title.prepend(icon, ' ');
        }

        const details = document.createElement('p');
        details.textContent = `${workout.minutes} хв, ${workout.calories} ккал`;

        const durationLabel = document.createElement('p');
        durationLabel.classList.add('workout-duration-label');
        if (workout.minutes < longWorkoutMinutes) {
            card.classList.add('short');
            durationLabel.textContent = 'Коротке тренування';
        } else {
            card.classList.add('long');
            durationLabel.textContent = 'Довге тренування';
        }

        card.append(title, details, durationLabel);
        if (workout.date) {
            const date = document.createElement('time');
            date.dateTime = workout.date;
            date.textContent = workout.date.split('-').reverse().join('.');
            card.append(date);
        }
        listContainer.append(card);

        totalCalories += workout.calories;
        totalMinutes += workout.minutes;
        if (workout.minutes > longestWorkout) {
            longestWorkout = workout.minutes;
        }
    }

    document.querySelector('#total-calories').textContent = `Спалено калорій: ${totalCalories} ккал`;
    document.querySelector('#workouts-count').textContent = workoutList.length;
    document.querySelector('#total-minutes').textContent = totalMinutes;
    document.querySelector('.record-value').textContent = `${longestWorkout} хв`;

    const progress = document.querySelector('#training-progress');
    const completedWorkouts = Math.min(workoutList.length, progress.max);
    const progressPercent = Math.round(completedWorkouts / progress.max * 100);
    progress.value = completedWorkouts;
    progress.textContent = `${progressPercent}%`;
    document.querySelector('#progress-label').textContent = `Виконано ${completedWorkouts} із ${progress.max} тренувань`;
    document.querySelector('#progress-percent').textContent = `${progressPercent}%`;
}

renderWorkouts(workouts);

const form = document.querySelector('#workout-form');
const dateInput = document.querySelector('#workout-date');
const typeInput = document.querySelector('#workout-type');
const minutesInput = document.querySelector('#workout-duration');
const caloriesInput = document.querySelector('#workout-calories');
const caloriesError = document.querySelector('#calories-error');
const caloriesPreview = document.querySelector('#calories-preview');
const formStatus = document.querySelector('#form-status');

// На input перевіряє межі калорій і перераховує ккал/хв до надсилання форми.
function updateWorkoutPreview() {
    const minutes = Number(minutesInput.value);
    const calories = Number(caloriesInput.value);
    let errorMessage = '';

    if (caloriesInput.value !== '' && (calories < 1 || calories > 2000)) {
        errorMessage = 'Кількість калорій має бути від 1 до 2000 ккал.';
    }

    caloriesInput.setCustomValidity(errorMessage);
    caloriesError.textContent = errorMessage;
    caloriesInput.setAttribute('aria-invalid', String(!caloriesInput.validity.valid));

    if (minutesInput.validity.valid && caloriesInput.validity.valid) {
        caloriesPreview.textContent = `${caloriesPerMinute({ minutes, calories })} ккал/хв`;
    } else {
        caloriesPreview.textContent = '—';
    }
    formStatus.textContent = '';
}

minutesInput.addEventListener('input', updateWorkoutPreview);
caloriesInput.addEventListener('input', updateWorkoutPreview);

// На submit додає перевірені дані до масиву, оновлює картки й очищує форму.
form.addEventListener('submit', event => {
    event.preventDefault();
    updateWorkoutPreview();
    if (!form.reportValidity()) {
        return;
    }

    const workout = {
        type: typeInput.value,
        icon: typeInput.selectedOptions[0].dataset.icon,
        date: dateInput.value,
        minutes: Number(minutesInput.value),
        calories: Number(caloriesInput.value)
    };

    workouts.push(workout);
    renderWorkouts(workouts);
    form.reset();
    updateWorkoutPreview();
    formStatus.textContent = `Тренування «${workout.type}» додано.`;
});
