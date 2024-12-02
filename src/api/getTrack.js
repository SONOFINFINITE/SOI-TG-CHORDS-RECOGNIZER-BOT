import { Shazam } from 'node-shazam';
import { deleteFile } from '../utils/downloader.js';
import { convertToRussian, improvedConvertToRussian, getTranslationVariants, isLikelyTranslit } from './getTranslate.js';

const shazam = new Shazam();

// Словарь для преобразования названий групп и песен
const songMappings = {
    'LUBE': 'ЛЮБЭ',
    'LYUBE': 'ЛЮБЭ',
    'LYBE': 'ЛЮБЭ',
    'LUBE\'': 'ЛЮБЭ',
    'LYUBE\'': 'ЛЮБЭ',
    'KOROL I SHUT': 'Король и Шут',
    'KOROL AND SHUT': 'Король и Шут',
    'KIS': 'Король и Шут',
    'KOROL & SHUT': 'Король и Шут',
    'SPLEAN': 'Сплин',
    'SPLEEN': 'Сплин',
    'SPLIN': 'Сплин',
    'SMYSLOVYE GALLYUTSINATSII': 'Смысловые Галлюцинации',
    'SMYSLOVYE GALLUTSINATSII': 'Смысловые Галлюцинации',
    'SMYSLOVIE GALLUCINACII': 'Смысловые Галлюцинации',
    'SG': 'Смысловые Галлюцинации',
};

async function tryTranslate(text) {
    try {
        const translations = await getTranslationVariants(text);
        if (translations && translations.length > 0) {
            return translations[0];
        }
    } catch (error) {
        console.log('Translation failed:', error.message);
    }
    return null;
}

function tryDirectMatch(text) {
    const upperText = text.toUpperCase();
    return songMappings[upperText] || null;
}

function tryTransliterate(text) {
    try {
        // Используем новую улучшенную функцию
        const converted = improvedConvertToRussian(text);
        if (converted && converted !== text.toLowerCase()) {
            return converted;
        }
    } catch (error) {
        console.log('Transliteration failed:', error.message);
        
        // Если новый метод не сработал, пробуем старый
        try {
            const fallbackConverted = convertToRussian(text);
            if (fallbackConverted !== text.toLowerCase()) {
                return fallbackConverted;
            }
        } catch (fallbackError) {
            console.log('Fallback transliteration failed:', fallbackError.message);
        }
    }
    return null;
}

export async function recognizeSong(filePath) {
    try {
        const result = await shazam.recognise(filePath, 'rus-RU');
        deleteFile(filePath);
        
        if (result && result.track) {
            const originalArtist = result.track.subtitle;
            const originalTitle = result.track.title;
            const isrc = result.track.isrc;
            
            console.log('Полный результат Shazam:', JSON.stringify(result.track, null, 2));
            console.log('Shazam result:', { artist: originalArtist, title: originalTitle });

            let artist = originalArtist;
            
            // Сначала проверяем прямое соответствие в словаре
            const directMatch = songMappings[originalArtist.toUpperCase()] || songMappings[originalArtist.replace(/\s+/g, ' ').trim().toUpperCase()];
            if (directMatch) {
                console.log('Найдено прямое соответствие в словаре:', {
                    from: originalArtist,
                    to: directMatch
                });
                artist = directMatch;
            } 
            // Проверяем ISRC только если артист не найден в словаре
            else if (isrc && /^(GB|US|AU|NZ|CA|IE|SE|NO|DK|NL|DE|FR|IT|ES|JP)/.test(isrc)) {
                console.log('Найден ISRC код страны с преимущественно английским контентом:', isrc);
                return {
                    title: originalTitle,
                    artist: originalArtist,
                    album: result.track.album?.title || '',
                    originalTitle: originalTitle,
                    originalArtist: originalArtist
                };
            }

            // Проверяем на транслит только если не нашли в словаре
            if (!directMatch) {
                // Проверяем, является ли имя исполнителя транслитом
                const artistIsTranslit = isLikelyTranslit(originalArtist);
                console.log('Проверка на транслит:', { artist: originalArtist, isTranslit: artistIsTranslit });

                if (artistIsTranslit) {
                    // Сначала пробуем перевести
                    console.log('Пробуем перевести имя артиста...');
                    const translations = await getTranslationVariants(originalArtist);
                    if (translations.length > 0) {
                        const translatedArtist = translations[0];
                        console.log('Найден перевод артиста:', { translatedArtist });
                        artist = translatedArtist;
                    } else {
                        // Если перевод не помог, пробуем транслитерацию
                        const transliteratedArtist = convertToRussian(originalArtist);
                        if (transliteratedArtist !== originalArtist.toLowerCase()) {
                            // Применяем регистр оригинала к транслитерированной версии
                            const preservedCase = transliteratedArtist
                                .split('')
                                .map((char, i) => originalArtist[i]?.toUpperCase() === originalArtist[i] ? 
                                    char.toUpperCase() : char)
                                .join('');

                            console.log('Применяем транслитерацию к исполнителю:', { 
                                from: originalArtist, 
                                to: preservedCase 
                            });
                            artist = preservedCase;
                        }
                    }
                }
            }

            // Возвращаем результат с возможным транслитом артиста
            return {
                title: originalTitle,
                artist: artist,
                album: result.track.album?.title || '',
                originalTitle: originalTitle,
                originalArtist: originalArtist
            };
        }
        return null;
    } catch (error) {
        console.error('Error recognizing song:', error);
        deleteFile(filePath);
        return null;
    }
}
