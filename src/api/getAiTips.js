import { default as MistralClient } from '@mistralai/mistralai';
import dotenv from 'dotenv';

dotenv.config();

const client = new MistralClient(process.env.MISTRAL_API_KEY);

export async function getAiTips(content) {
    console.log('[CHORDS] Markdown конвертирован, длина:', content.length);
        
    // Формируем промпт для Mistral
    const prompt = `Проанализируй следующий текст песни с аккордами и верни информацию в следующем формате:

1. Сначала выведи "<b>Уникальные аккорды:</b>" и через запятую все уникальные аккорды из песни в порядке их появления в тексте.

2. Затем, основываясь на анализе текста песни, аккордов, их последовательностей и общего настроения композиции, дай персонализированные советы по исполнению именно этой песни в таком формате не больше 250 символов:

<b>Советы по исполнению трека на гитаре:</b>

<b>Стиль исполнения:</b>
<i>Бой/Перебор:</i> Опиши конкретный паттерн боя или перебора, который лучше всего подходит для этой песни, учитывая её ритм и настроение.
<i>Техника:</i> Предложи специфические техники исполнения, которые подчеркнут характер именно этой композиции.

<b>Ритмический рисунок:</b>
<i>Темп:</i> Укажи примерный темп и его особенности для этой песни.
<i>Акценты:</i> Опиши, на каких долях или аккордах стоит делать акценты в этой конкретной песне.

<b>Использование устройств:</b>
<i>Каподастр:</i> Если нужен каподастр, укажи конкретный лад и почему это упростит игру именно этой песни.
<i>Звучание:</i> Предложи настройки звука, которые подойдут для этой композиции.

<b>Практические советы:</b>
<i>Сложные места:</i> Укажи конкретные сложные места в песне и как их лучше отработать.
<i>Последовательность разучивания:</i> Предложи порядок разучивания частей именно этой песни.

Текст песни для анализа:
${content}`;

    console.log('[CHORDS] Подготовлен промпт для Mistral, длина:', prompt.length);
    console.log('[CHORDS] Проверяем API ключ:', process.env.MISTRAL_API_KEY ? 'Установлен' : 'Отсутствует');

    try {
        console.log('[CHORDS] Отправляем запрос к Mistral API...');
        // Отправляем запрос к Mistral
        const response = await client.chat({
            model: "mistral-large-2411",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        console.log('[CHORDS] Получен ответ от Mistral API:', JSON.stringify(response, null, 2));

        // Проверяем наличие ответа
        if (!response) {
            console.error('[CHORDS] Ответ от API пустой');
            throw new Error('Пустой ответ от Mistral API');
        }

        if (!response.choices) {
            console.error('[CHORDS] В ответе отсутствует поле choices:', response);
            throw new Error('В ответе отсутствует поле choices');
        }

        if (!response.choices[0]) {
            console.error('[CHORDS] Массив choices пуст:', response.choices);
            throw new Error('Массив choices пуст');
        }

        if (!response.choices[0].message) {
            console.error('[CHORDS] Отсутствует поле message в первом выборе:', response.choices[0]);
            throw new Error('Отсутствует поле message в первом выборе');
        }

        console.log('[CHORDS] Успешно получен контент из ответа:', response.choices[0].message.content);

        return response.choices[0].message.content;
    } catch (mistralError) {
        console.error('[CHORDS] Ошибка при обработке Mistral API:', mistralError);
        console.error('[CHORDS] Полная информация об ошибке:', {
            name: mistralError.name,
            message: mistralError.message,
            stack: mistralError.stack,
            response: mistralError.response ? {
                status: mistralError.response.status,
                data: mistralError.response.data
            } : 'Нет данных ответа'
        });
        return 'Не удалось проанализировать аккорды: ' + mistralError.message;
    }
}
