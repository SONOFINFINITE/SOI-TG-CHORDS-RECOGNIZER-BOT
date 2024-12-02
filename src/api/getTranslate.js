import fetch from 'node-fetch';
import CyrillicToTranslit from 'cyrillic-to-translit-js';

// Таблица обратной транслитерации (английские буквы в русские)
const reverseTranslitMap = {
    'ea': 'и',     // Важно! Составные комбинации должны быть перед одиночными буквами
    'yo': 'ё',
    'zh': 'ж',
    'ch': 'ч',
    'sh': 'ш',
    'sch': 'щ',
    'yu': 'ю',
    'ya': 'я',
    'iy': 'ий',    // Для окончаний типа "laskoviy"
    'y': 'й',      // По умолчанию y -> й
    'a': 'а',
    'b': 'б',
    'v': 'в',
    'w': 'в',
    'g': 'г',
    'h': 'х',
    'd': 'д',
    'e': 'е',
    'z': 'з',
    'i': 'и',
    'k': 'к',
    'l': 'л',
    'm': 'м',
    'n': 'н',
    'o': 'о',
    'p': 'п',
    'r': 'р',
    's': 'с',
    't': 'т',
    'u': 'у',
    'f': 'ф',
    'c': 'ц',
    "'": 'ь',
    'ye': 'ые',    // Для окончаний прилагательных типа "smyslovye"
};

// Типичные английские артикли, предлоги и части имен
const englishWords = new Set([
    'the', 'a', 'an',
    'and', 'or', 'but',
    'in', 'on', 'at', 'to', 'for', 'of',
    'feat', 'featuring', 'vs', 'versus',
    'mr', 'mrs', 'ms', 'dr',
    'dj', 'mc', 'sir',
    // Добавляем популярные английские слова, часто встречающиеся в названиях групп
    'black', 'white', 'red', 'blue', 'green',
    'band', 'boys', 'girls', 'brothers', 'sisters',
    'king', 'queen', 'prince', 'princess',
    'rock', 'pop', 'jazz', 'blues', 'metal',
    'little', 'big', 'young', 'old',
    'death', 'dead', 'life', 'live',
    'sun', 'moon', 'star', 'sky',
    'deep', 'high', 'low',
    'new', 'old'
]);

// Паттерны, характерные для транслита
const translitPatterns = [
    'zh', 'ch', 'sh', 'sch', 'shch', 
    'yu', 'ya', 'yo', 'ts', 'kh'
];

// Функция для проверки содержит ли текст кириллицу
const containsCyrillic = (text) => /[а-яА-ЯёЁ]/.test(text);

// Функция для проверки содержит ли текст только латиницу
const containsOnlyLatin = (text) => /^[a-zA-Z\s'-]+$/.test(text);

// Расширяем список характерных для транслита окончаний
const translitEndings = [
    'ov', 'ev', 'in', 'iy', 'yi', 'oy', 'sky', 'skiy', 'skaya',
    'yan', 'ian', 'yan', 'jan', 'khan', 'glu', 'uli', 'dze',
    'shvili', 'adze', 'idze', 'enko', 'yuk', 'yuk', 'chuk',
    'man', 'berg', 'mir', 'ovich', 'evich', 'ovna', 'evna'
];

/**
 * Определяет, является ли текст транслитом русских слов
 * @param {string} text - Текст для проверки
 * @returns {boolean} true если текст похож на транслит
 */
export function isLikelyTranslit(text) {
    // Если текст содержит кириллицу, это не транслит
    if (containsCyrillic(text)) return false;

    // Игнорируем числа и специальные символы
    const words = text.toLowerCase()
        .replace(/[0-9.,!?()[\]{}]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 1);  // Игнорируем однобуквенные слова

    if (words.length === 0) return false;

    let translitWordCount = 0;
    let totalNonEnglishWords = 0;

    for (const word of words) {
        // Пропускаем известные английские слова
        if (englishWords.has(word)) continue;

        totalNonEnglishWords++;

        // Проверяем на характерные для транслита паттерны
        const hasTranslitPattern = translitPatterns.some(pattern => word.includes(pattern));
        if (hasTranslitPattern) {
            translitWordCount++;
            continue;
        }

        // Проверяем на характерные окончания
        const hasTranslitEnding = translitEndings.some(ending => word.endsWith(ending));
        if (hasTranslitEnding) {
            translitWordCount++;
            continue;
        }

        // Проверяем на нетипичные для английского языка сочетания согласных
        const hasUncommonConsonants = /[bcdfghjklmnpqrstvwxz]{3,}/.test(word) || 
                                    /[aeiouy]{3,}/.test(word);  // Также проверяем необычные сочетания гласных
        if (hasUncommonConsonants) {
            translitWordCount++;
            continue;
        }

        // Если слово содержит только латиницу, но не является английским словом,
        // и в нем есть необычные сочетания букв
        if (containsOnlyLatin(word) && 
            (/[szh]/.test(word) || /[aeiouy]{2,}/.test(word))) {
            translitWordCount++;
        }
    }

    // Если все слова, которые не являются английскими,
    // имеют признаки транслита - считаем это транслитом
    return totalNonEnglishWords > 0 && 
           translitWordCount / totalNonEnglishWords >= 0.5;
}

/**
 * Конвертирует текст из английской транслитерации в русские буквы
 * @param {string} text - Текст для конвертации
 * @returns {string} Текст с русскими буквами
 */
export function convertToRussian(text) {
    let result = text.toLowerCase();
    
    // Сначала обрабатываем составные буквы
    const compositeChars = ['ea', 'yo', 'zh', 'kh', 'ts', 'ch', 'sh', 'sch', 'shch', 'yu', 'ya'];
    for (const comp of compositeChars) {
        if (reverseTranslitMap[comp]) {
            result = result.replace(new RegExp(comp, 'g'), reverseTranslitMap[comp]);
        }
    }
    
    // Затем обрабатываем одиночные буквы
    for (const [eng, rus] of Object.entries(reverseTranslitMap)) {
        if (eng.length === 1) {
            result = result.replace(new RegExp(eng, 'g'), rus);
        }
    }
    
    return result;
}

/**
 * Улучшенная функция транслитерации с использованием библиотеки
 * @param {string} text - Текст для конвертации
 * @returns {string} Текст с русскими буквами
 */
export function improvedConvertToRussian(text) {
    let result = text.toLowerCase();
    
    // Сначала обрабатываем специальные случаи
    result = result
        // Окончания прилагательных
        .replace(/([a-z])ye\b/g, '$1ые')
        // Окончания существительных
        .replace(/([a-z])y\b/g, '$1ый')
        // Окончания типа "laskoviy"
        .replace(/([a-z])iy\b/g, '$1ий');
    
    // Затем обрабатываем остальные случаи
    for (const [latin, cyrillic] of Object.entries(reverseTranslitMap)) {
        result = result.replace(new RegExp(latin, 'g'), cyrillic);
    }
    
    return result;
}

/**
 * Получает варианты перевода текста через Google Translate
 * @param {string} text - Текст для перевода
 * @returns {Promise<string[]>} Массив вариантов перевода
 */
export async function getTranslationVariants(text) {
    try {
        const translations = new Set();
        
        // Подготавливаем текст для перевода
        const textForTranslate = prepareTextForTranslation(text);
        const encodedText = encodeURIComponent(textForTranslate);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&dt=at&dt=ss&dt=bd&q=${encodedText}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        /*
         * Структура ответа от Google Translate API:
         * data[0] - Основные переводы
         *   data[0][0][0] - Основной перевод всего текста
         * 
         * data[1] - Альтернативные переводы для каждого слова
         *   data[1][i][0] - Оригинальное слово
         *   data[1][i][2] - Массив вариантов перевода для этого слова
         *     data[1][i][2][j][0] - Вариант перевода
         */
        
        // Добавляем основной перевод
        const mainTranslation = getMainTranslation(data);
        if (mainTranslation) {
            translations.add(mainTranslation);
        }
        
        // Добавляем альтернативные переводы
        const alternativeTranslations = getAlternativeTranslations(data);
        alternativeTranslations.forEach(translation => translations.add(translation));
        
        const result = Array.from(translations);
        console.log('[TRANSLATE] Translation variants:', result);
        return result;
    } catch (error) {
        console.error('[TRANSLATE] Error getting translation variants:', error);
        return [];
    }
}

// Подготавливает текст для перевода, разделяя слова пробелами
function prepareTextForTranslation(text) {
    return text
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // CamelCase -> Camel Case
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // XMLHttp -> XML Http
        .replace(/([a-z])I([A-Z])/g, '$1 I $2');  // KorolIShut -> Korol I Shut
}

// Извлекает основной перевод из ответа API
function getMainTranslation(data) {
    if (!data[0]?.[0]?.[0]) return null;
    return data[0][0][0];
}

// Извлекает альтернативные переводы из ответа API
function getAlternativeTranslations(data) {
    const translations = new Set();
    
    if (!data[1]) return [];
    
    data[1].forEach(wordData => {
        // wordData[0] - оригинальное слово
        // wordData[2] - массив вариантов перевода
        if (!wordData?.[0] || !wordData?.[2]) return;
        
        // Добавляем перевод целого слова
        translations.add(wordData[0]);
        
        // Добавляем все варианты перевода
        wordData[2].forEach(variant => {
            if (variant?.[0]) translations.add(variant[0]);
        });
    });
    
    return Array.from(translations);
}

/**
 * Переводит текст на русский язык
 * @param {string} text - Текст для перевода
 * @returns {Promise<string>} Переведенный текст
 */
export async function translateToRussian(text) {
    try {
        const variants = await getTranslationVariants(text);
        return variants[0] || text;
    } catch (error) {
        console.error('[TRANSLATE] Error translating to Russian:', error);
        return text;
    }
}
