'use strict';

// Практикум №11, варіант 19. Модель: id (автоматичний), type, duration (хв), date.
// calories та icon зберігаємо додатково для функцій попередніх практикумів.
const WorkoutStorage = (() => {
    const DB_NAME = 'WorkoutTrackerDB';
    const STORE_NAME = 'workouts';
    const LOCAL_KEY = 'workoutTracker.workouts';
    const MIGRATION_KEY = 'workoutTracker.migrated';
    let database = null;
    let warning = '';

    // Перевіряє збережені дані та підтримує стару назву minutes під час міграції.
    function normalizeItem(item) {
        if (!item || typeof item !== 'object') throw new Error('Некоректний запис тренування.');
        const duration = item.duration ?? item.minutes;
        const calories = item.calories ?? 0;
        if (typeof item.type !== 'string' || !item.type.trim()
            || !Number.isInteger(duration) || duration <= 0
            || !Number.isFinite(calories) || calories < 0
            || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
            || !Number.isFinite(Date.parse(item.date))
            || new Date(item.date).toISOString().slice(0, 10) !== item.date) {
            throw new Error('Некоректні поля тренування.');
        }
        // Звичайний об'єкт, а не Proxy Vue: IndexedDB використовує structured clone.
        const record = { type: item.type, duration, date: item.date, calories,
            icon: typeof item.icon === 'string' ? item.icon : '' };
        if (item.id !== undefined) {
            if (!Number.isSafeInteger(item.id) || item.id < 1) throw new Error('Некоректний id.');
            record.id = item.id;
        }
        return record;
    }

    // localStorage синхронний і зберігає лише рядки, тому використовуємо JSON.
    function saveToLocalStorage(items) {
        try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
            return true;
        } catch (error) {
            warning = 'Не вдалося оновити резервну копію в браузері. Основні дані збережено в базі.';
            console.error('Помилка запису localStorage:', error);
            return false;
        }
    }

    // Пошкоджений JSON не зупиняє застосунок: повертаємо порожній список.
    function loadFromLocalStorage(defaultItems = []) {
        try {
            const raw = localStorage.getItem(LOCAL_KEY);
            const items = raw === null ? defaultItems : JSON.parse(raw);
            if (!Array.isArray(items)) throw new Error('Очікувався масив тренувань.');
            const records = items.map(normalizeItem);
            const ids = records.filter(item => item.id !== undefined).map(item => item.id);
            if (new Set(ids).size !== ids.length) throw new Error('Повторюються id тренувань.');
            return records;
        } catch (error) {
            warning = 'Не вдалося прочитати попередню локальну копію тренувань.';
            console.error('Помилка читання localStorage:', error);
            return [];
        }
    }

    // Відкриває IndexedDB версії 1; схема створюється лише в onupgradeneeded.
    function openDB() {
        if (database) return Promise.resolve(database);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            let blocked = false;
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = () => {
                if (blocked) { request.result.close(); return; }
                database = request.result;
                database.onversionchange = () => { database.close(); database = null; };
                resolve(database);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                blocked = true;
                reject(new Error('Закрийте інші вкладки трекера та оновіть сторінку.'));
            };
        });
    }

    // Очікує завершення всієї транзакції, а не лише окремого запиту.
    async function runTransaction(mode, operation) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            let result;
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error || new Error('Помилка транзакції.'));
            tx.onabort = () => reject(tx.error || new Error('Транзакцію скасовано.'));
            try {
                const request = operation(tx.objectStore(STORE_NAME));
                request.onsuccess = () => { result = request.result; };
            } catch (error) {
                tx.abort();
                reject(error);
            }
        });
    }

    // CREATE: id нового запису генерує IndexedDB, не лічильник у JavaScript.
    function addItem(item) {
        const record = normalizeItem(item);
        delete record.id;
        return runTransaction('readwrite', store => store.add(record));
    }

    // READ: дані для Vue завжди отримуємо з IndexedDB.
    function getAllItems() {
        return runTransaction('readonly', store => store.getAll());
    }

    // UPDATE: put із тим самим id оновлює запис без створення дубліката.
    function updateItem(item) {
        const record = normalizeItem(item);
        if (record.id === undefined) throw new Error('Для оновлення потрібен id.');
        return runTransaction('readwrite', store => store.put(record));
    }

    // DELETE: видаляє один запис за його первинним ключем.
    function deleteItem(id) {
        return runTransaction('readwrite', store => store.delete(id));
    }

    // Переносить усі старі записи атомарно; повторно перевіряє порожність у транзакції.
    async function migrateFromLocalStorage(defaultItems) {
        let migrated = false;
        try { migrated = localStorage.getItem(MIGRATION_KEY) === 'true'; }
        catch (error) { console.error('Прапорець міграції недоступний:', error); }
        if (migrated) return;

        const existing = await getAllItems();
        if (existing.length === 0) {
            const records = loadFromLocalStorage(defaultItems);
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const count = store.count();
                count.onsuccess = () => {
                    if (count.result === 0) {
                        for (const record of records) store.put(record);
                    }
                };
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('Міграцію скасовано.'));
            });
        }
        // Прапорець ставимо після успішного commit, зокрема для порожнього списку.
        try { localStorage.setItem(MIGRATION_KEY, 'true'); }
        catch (error) { console.error('Не вдалося зберегти прапорець міграції:', error); }
    }

    function takeWarning() {
        const message = warning;
        warning = '';
        return message;
    }

    return { openDB, addItem, getAllItems, updateItem, deleteItem,
        saveToLocalStorage, loadFromLocalStorage, migrateFromLocalStorage, takeWarning };
})();

