'use strict';

console.log('script.js підключено');

// Практична робота №6, варіант 19: трекер тренувань.
// Тривалість відповідає карткам на сторінці, калорії — навчальні дані.
const workouts = [
    { type: 'Жим лежачи', minutes: 45, calories: 270 },
    { type: 'Пробіжка', minutes: 120, calories: 960 }
];

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
