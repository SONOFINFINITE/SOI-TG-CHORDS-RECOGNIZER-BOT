import puppeteer from 'puppeteer';
import { getAiTips } from './getAiTips.js';
import { getTranslationVariants, convertToRussian, isLikelyTranslit } from './getTranslate.js';
import dotenv from 'dotenv';

dotenv.config();

// Функция для создания случайной задержки в заданном диапазоне
async function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    console.log(`[CHORDS] Ждем ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

// Функция для эмуляции человеческого поведения
async function humanBehavior(page) {
    // Случайные движения мыши
    await page.mouse.move(Math.random() * 500, Math.random() * 500);
    await randomDelay(100, 500);
    
    // Случайный скролл
    await page.mouse.wheel({ deltaY: Math.random() * 200 - 100 });
    await randomDelay(200, 800);
}

// Функция для проверки содержит ли строка кириллицу
const containsCyrillic = (text) => /[а-яА-ЯёЁ]/.test(text);

// Функция для удаления скобок и их содержимого
const removeParentheses = (text) => {
    const withoutParentheses = text.replace(/\([^)]*\)/g, '').trim();
    return withoutParentheses !== text ? withoutParentheses : null;
};

// Функция для поиска аккордов с возможностью удаления скобок
async function searchWithAndWithoutParentheses(title, artist, searchFunction) {
    // Пробуем сначала с оригинальными названиями
    const result = await searchFunction(title, artist);
    if (result) return result;

    // Проверяем есть ли скобки в названии
    const titleWithoutParentheses = removeParentheses(title);
    const artistWithoutParentheses = removeParentheses(artist);

    if (titleWithoutParentheses || artistWithoutParentheses) {
        console.log('[CHORDS] Пробуем поиск без скобок:', {
            title: titleWithoutParentheses || title,
            artist: artistWithoutParentheses || artist
        });
        return await searchFunction(
            titleWithoutParentheses || title,
            artistWithoutParentheses || artist
        );
    }

    return null;
}

export async function getChordInfo(title, artist, songInfo = null) {
    console.log(`[CHORDS] Начинаем поиск аккордов для "${title} - ${artist}"`);
    
    try {
        console.log('[CHORDS] Запускаем браузер...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled',
                '--disable-javascript-harmony-shipping'
            ]
        });

        const page = await browser.newPage();
        
        // Рандомизируем User-Agent
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edge/120.0.0.0'
        ];
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        
        // Эмулируем типичные браузерные параметры
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US'] });
        });

        await page.setDefaultNavigationTimeout(120000);
        await page.setDefaultTimeout(120000);
        await page.setViewport({ 
            width: 1920 + Math.floor(Math.random() * 100),
            height: 1080 + Math.floor(Math.random() * 100)
        });

        // Настраиваем заголовки запроса
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document'
        });

        // Блокируем ненужные ресурсы
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const url = request.url();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) || 
                url.includes('google') || 
                url.includes('analytics') ||
                url.includes('facebook') ||
                url.includes('doubleclick')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Формируем поисковый запрос
        const searchQuery = encodeURIComponent(`${artist} ${title}`).replace(/%20/g, '+');
        const searchUrl = `https://454.amdm.ru/search/?q=${searchQuery}`;
        console.log('[CHORDS] Поисковый URL:', decodeURI(searchUrl));

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 120000 });
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        // Ищем нужную песню в результатах поиска
        const songLink = await page.evaluate((artistName, songName) => {
            const log = (...args) => {
                console.log('[CHORDS Search]', ...args);
            };

            const rows = document.querySelectorAll('table.items tbody tr');
            log(`Всего найдено результатов: ${rows.length}`);
            log(`Ищем: "${artistName}" - "${songName}"`);
            
            // Функция для нормализации текста
            const normalize = text => text.toLowerCase().trim()
                .replace(/\s+/g, ' ')
                .replace(/ё/g, 'е')
                .replace(/[.,!?()]/g, '');
            
            const normalizedArtist = normalize(artistName);
            const normalizedSong = normalize(songName);
            
            log('Нормализованный поиск:', { 
                artist: normalizedArtist,
                song: normalizedSong 
            });

            // Вспомогательная функция для проверки совпадения
            const checkMatch = (rowArtist, rowSong, matchType = 'exact') => {
                const normalizedRowArtist = normalize(rowArtist);
                const normalizedRowSong = normalize(rowSong);
                
                log(`Сравниваем (${matchType}):`, {
                    rowArtist: normalizedRowArtist,
                    rowSong: normalizedRowSong
                });

                let artistMatch = false;
                let songMatch = false;

                switch (matchType) {
                    case 'exact':
                        artistMatch = normalizedRowArtist === normalizedArtist;
                        songMatch = normalizedRowSong === normalizedSong;
                        break;
                    case 'contains':
                        artistMatch = normalizedRowArtist.includes(normalizedArtist) || 
                                    normalizedArtist.includes(normalizedRowArtist);
                        songMatch = normalizedRowSong.includes(normalizedSong) || 
                                  normalizedSong.includes(normalizedRowSong);
                        break;
                    case 'fuzzy':
                        artistMatch = normalizedRowArtist.includes(normalizedArtist) || 
                                    normalizedArtist.includes(normalizedRowArtist);
                        songMatch = normalizedRowSong.includes(normalizedSong) || 
                                  normalizedSong.includes(normalizedRowSong);
                        break;
                }

                return artistMatch && songMatch;
            };
            
            // Перебираем все результаты и собираем информацию
            const results = Array.from(rows).map(row => {
                const artistElement = row.querySelector('td.artist_name a.artist');
                const songElement = row.querySelector('td.artist_name a:nth-child(2)');
                const verifiedBadge = row.querySelector('td.artist_name span.fa-check-circle');
                
                if (!artistElement || !songElement) return null;
                
                return {
                    artist: artistElement.textContent,
                    song: songElement.textContent,
                    verified: !!verifiedBadge,
                    href: songElement.href
                };
            }).filter(Boolean);

            log('Найденные результаты:', results);

            // Ищем по разным критериям
            const findMatch = (matchType) => {
                return results.find(result => 
                    checkMatch(result.artist, result.song, matchType)
                );
            };

            // 1. Сначала ищем точное совпадение с верификацией
            const verifiedMatch = results.find(result => 
                result.verified && checkMatch(result.artist, result.song, 'exact')
            );
            if (verifiedMatch) {
                log('Найдено верифицированное совпадение:', verifiedMatch);
                return verifiedMatch.href;
            }

            // 2. Затем точное совпадение без верификации
            const exactMatch = findMatch('exact');
            if (exactMatch) {
                log('Найдено точное совпадение:', exactMatch);
                return exactMatch.href;
            }

            // 3. Ищем частичное совпадение
            const containsMatch = findMatch('contains');
            if (containsMatch) {
                log('Найдено частичное совпадение:', containsMatch);
                return containsMatch.href;
            }

            // 4. В крайнем случае, используем нечеткое сравнение
            const fuzzyMatch = findMatch('fuzzy');
            if (fuzzyMatch) {
                log('Найдено нечеткое совпадение:', fuzzyMatch);
                return fuzzyMatch.href;
            }

            // Если есть хоть один результат, берем первый
            if (results.length > 0) {
                log('Берем первый доступный результат:', results[0]);
                return results[0].href;
            }
            
            log('Совпадений не найдено');
            return null;
        }, artist, title);

        if (!songLink) {
            await browser.close();
            
            // Если у нас есть оригинальные названия из Shazam
            if (songInfo?.originalTitle && songInfo?.originalArtist) {
                // Если исполнитель уже был преобразован через словарь
                if (artist !== songInfo.originalArtist) {
                    console.log('[CHORDS] Исполнитель был преобразован через словарь, работаем только с названием песни');
                    
                    // 1. Пробуем оригинальное название
                    const originalResult = await searchWithAndWithoutParentheses(
                        songInfo.originalTitle,
                        artist,
                        async (t, a) => await getChordInfo(t, a)
                    );
                    if (originalResult) return originalResult;

                    // 2. Пробуем транслитерацию названия
                    console.log('[CHORDS] Пробуем транслитерацию названия...');
                    const transliteratedTitle = convertToRussian(songInfo.originalTitle);
                    if (transliteratedTitle !== songInfo.originalTitle.toLowerCase()) {
                        console.log('[CHORDS] Транслитерация названия:', { transliteratedTitle });
                        const result = await searchWithAndWithoutParentheses(
                            transliteratedTitle,
                            artist,
                            async (t, a) => await getChordInfo(t, a)
                        );
                        if (result) return result;
                    }

                    // 3. В последнюю очередь пробуем перевести название
                    console.log('[CHORDS] Пробуем перевести название...');
                    const titleTranslations = await getTranslationVariants(songInfo.originalTitle);
                    if (titleTranslations.length > 0) {
                        const translatedTitle = titleTranslations[0];
                        console.log('[CHORDS] Найден перевод названия:', { translatedTitle });
                        return await searchWithAndWithoutParentheses(
                            translatedTitle,
                            artist,
                            async (t, a) => await getChordInfo(t, a)
                        );
                    }

                    return null;
                }

                // Проверяем, является ли имя исполнителя транслитом
                const artistIsTranslit = isLikelyTranslit(artist);
                console.log('[CHORDS] Проверка на транслит:', { 
                    artist: artist, 
                    isTranslit: artistIsTranslit 
                });

                if (artistIsTranslit) {
                    // Если это транслит, сначала пробуем перевести оригинальное имя
                    console.log('[CHORDS] Пробуем перевести оригинальное имя артиста...');
                    const artistTranslations = await getTranslationVariants(songInfo.originalArtist);
                    if (artistTranslations.length > 0) {
                        const translatedArtist = artistTranslations[0];
                        console.log('[CHORDS] Найден перевод артиста:', { translatedArtist });
                        
                        // Пробуем с переведенным артистом
                        const translatedArtistResult = await searchWithAndWithoutParentheses(
                            songInfo.originalTitle,
                            translatedArtist,
                            async (t, a) => await getChordInfo(t, a)
                        );
                        if (translatedArtistResult) return translatedArtistResult;
                    }

                    // Если перевод не помог или не найден, пробуем транслитерацию
                    console.log('[CHORDS] Пробуем транслитерацию артиста...');
                    const transliteratedArtist = convertToRussian(songInfo.originalArtist);
                    if (transliteratedArtist !== songInfo.originalArtist.toLowerCase()) {
                        console.log('[CHORDS] Транслитерация артиста:', { transliteratedArtist });
                        
                        // Пробуем с транслитерированным артистом и оригинальным названием (со скобками и без)
                        const transliteratedArtistResult = await searchWithAndWithoutParentheses(
                            songInfo.originalTitle,
                            transliteratedArtist,
                            async (t, a) => await getChordInfo(t, a)
                        );
                        if (transliteratedArtistResult) return transliteratedArtistResult;

                        // Если не помогло, пробуем перевести название
                        console.log('[CHORDS] Пробуем перевести название при транслитерированном артисте...');
                        const titleTranslations = await getTranslationVariants(songInfo.originalTitle);
                        if (titleTranslations.length > 0) {
                            const translatedTitle = titleTranslations[0];
                            console.log('[CHORDS] Найден перевод названия:', { translatedTitle });
                            
                            const transliteratedArtistTranslatedTitleResult = await searchWithAndWithoutParentheses(
                                translatedTitle,
                                transliteratedArtist,
                                async (t, a) => await getChordInfo(t, a)
                            );
                            if (transliteratedArtistTranslatedTitleResult) return transliteratedArtistTranslatedTitleResult;
                        }

                        // В последнюю очередь пробуем транслитерацию названия
                        console.log('[CHORDS] Пробуем транслитерацию названия при транслитерированном артисте...');
                        const transliteratedTitle = convertToRussian(songInfo.originalTitle);
                        if (transliteratedTitle !== songInfo.originalTitle.toLowerCase()) {
                            console.log('[CHORDS] Транслитерация названия:', { transliteratedTitle });
                            return await searchWithAndWithoutParentheses(
                                transliteratedTitle,
                                transliteratedArtist,
                                async (t, a) => await getChordInfo(t, a)
                            );
                        }
                    }
                } else {
                    // Если это не транслит, идем по стандартной схеме
                    // 1. Пробуем поиск с оригинальными названиями (со скобками и без)
                    const originalResult = await searchWithAndWithoutParentheses(
                        songInfo.originalTitle,
                        songInfo.originalArtist,
                        async (t, a) => await getChordInfo(t, a)
                    );
                    if (originalResult) return originalResult;

                    // 2. Пробуем перевести исполнителя
                    console.log('[CHORDS] Пробуем перевести исполнителя...');
                    const artistTranslations = await getTranslationVariants(songInfo.originalArtist);
                    
                    if (artistTranslations.length > 0) {
                        const translatedArtist = artistTranslations[0];
                        console.log('[CHORDS] Найден перевод исполнителя:', { translatedArtist });
                        
                        // 3. Пробуем перевести название песни
                        console.log('[CHORDS] Пробуем перевести название песни...');
                        const titleTranslations = await getTranslationVariants(songInfo.originalTitle);
                        
                        if (titleTranslations.length > 0) {
                            const translatedTitle = titleTranslations[0];
                            console.log('[CHORDS] Найден перевод названия:', { translatedTitle });
                            
                            const translatedResult = await searchWithAndWithoutParentheses(
                                translatedTitle,
                                translatedArtist,
                                async (t, a) => await getChordInfo(t, a)
                            );
                            if (translatedResult) return translatedResult;
                        }
                    }

                    // Только если все предыдущие попытки не удались, пробуем транслитерацию
                    console.log('[CHORDS] Переводы не помогли, пробуем транслитерацию как последнее средство...');
                    const transliteratedArtist = convertToRussian(songInfo.originalArtist);
                    if (transliteratedArtist !== songInfo.originalArtist.toLowerCase()) {
                        console.log('[CHORDS] Транслитерация артиста:', { transliteratedArtist });
                        return await searchWithAndWithoutParentheses(
                            songInfo.originalTitle,
                            transliteratedArtist,
                            async (t, a) => await getChordInfo(t, a)
                        );
                    }
                }
            }
            
            return null;
        }

        // Переходим на страницу с аккордами
        console.log('[CHORDS] Переходим на страницу с аккордами:', songLink);
        await page.goto(songLink, { waitUntil: 'networkidle2', timeout: 120000 });
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        // Извлекаем текст и аккорды
        const content = await page.evaluate(() => {
            const chordsBlock = document.querySelector('pre[itemprop="chordsBlock"]');
            if (!chordsBlock) return null;

            // Получаем список оригинальных аккордов из HTML
            const originalChords = [];
            $('div.podbor__chord').each((_, elem) => {
                const chord = $(elem).attr('data-chord');
                if (chord) {
                    originalChords.push(chord.trim());
                }
            });

            // Создаем Set уникальных аккордов для быстрой проверки
            const validChords = new Set(originalChords);

            // Функция для проверки является ли слово аккордом из оригинала
            const isValidChord = (word) => {
                // Нормализуем аккорд для сравнения
                const normalized = word.trim()
                    .replace(/\s+/g, '')
                    .replace(/([A-H][b#]?)(.*)/, '$1$2');
                return validChords.has(normalized);
            };

            // Функция для извлечения аккордов из строки
            const extractChords = (line) => {
                return line.trim()
                    .split(/\s+/)
                    .filter(word => 
                        word.match(/^[A-H][b#]?(m|sus|add|maj|dim|aug|-|\d)*$/) &&
                        isValidChord(word)
                    );
            };

            // Обработка строк
            const processedLines = [];
            let i = 0;
            
            while (i < chordsBlock.textContent.trim().split('\n').length) {
                const currentLine = chordsBlock.textContent.trim().split('\n')[i].trim();
                
                // Пропускаем пустые строки
                if (!currentLine) {
                    i++;
                    continue;
                }

                // Сохраняем заголовки секций
                if (currentLine.match(/^(Припев:|Проигрыш:|Куплет:|Бридж:)/)) {
                    processedLines.push(currentLine);
                    i++;
                    continue;
                }

                // Проверяем есть ли в строке валидные аккорды
                const chords = extractChords(currentLine);
                
                if (chords.length > 0) {
                    // Проверяем следующую строку
                    const nextLine = i + 1 < chordsBlock.textContent.trim().split('\n').length ? chordsBlock.textContent.trim().split('\n')[i + 1].trim() : null;
                    const nextChords = nextLine ? extractChords(nextLine) : [];

                    // Если следующая строка содержит те же аккорды - пропускаем её
                    if (nextChords.length > 0 && 
                        chords.length === nextChords.length && 
                        chords.every((chord, idx) => chord === nextChords[idx])) {
                        i++; // Пропускаем следующую строку
                    }
                }

                processedLines.push(currentLine);
                i++;
            }

            return processedLines
                .join('\n')
                .replace(/\n{3,}/g, '\n\n')  // Нормализуем переносы строк
                .replace(/^(Припев:|Проигрыш:|Куплет:|Бридж:)/gm, '\n$1')  // Добавляем отступы перед секциями
                .trim();
        });

        if (!content) {
            throw new Error('Не удалось найти блок с аккордами на странице');
        }

        await browser.close();
        console.log('[CHORDS] Браузер закрыт');
        console.log('[CHORDS] Получен контент, длина:', content.length);

        // Оборачиваем в теги pre и code для сохранения форматирования
        const markdown = '<pre><code>' + content + '</code></pre>';

        // Получаем анализ от ИИ
        const analysis = await getAiTips(content);

        // Возвращаем результат
        return {
            formatted: markdown,
            analysis: analysis
        };

    } catch (error) {
        console.error('[CHORDS] Критическая ошибка:', error);
        throw error;
    }
}
