import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { recognizeSong } from './api/getTrack.js';
import { getChordInfo } from './api/getChords.js';
import { downloadFile, deleteFile } from './utils/downloader.js';

dotenv.config();

const bot = new Bot(process.env.BOT_TOKEN);

// Приветственное сообщение
bot.command('start', async (ctx) => {
    await ctx.reply(
        `🎸 Приветствую, музыкальный искатель! 🎵 Я здесь, чтобы помочь тебе найти аккорды из аудиозаписей и раскрыть потрясающее звучание мелодий. Доверься мне, и вместе мы пройдем по волнам музыки и создадим гармонию звуков. Погрузимся в мир музыкального творчества вместе! 🎼

📝 Как пользоваться:
1. Отправь мне аудио с песней
2. Я распознаю песню и найду аккорды
3. Получи текст песни с аккордами и советы по исполнению

🎯 Просто отправь мне любую песню, и я помогу тебе!`
    );
});

// Обработка аудио
bot.on(['message:audio'], async (ctx) => {
    let filePath;
    try {
        await ctx.reply('Загружаю файл и пытаюсь распознать песню... 🎵');
        
        let file;
        
        if (ctx.message.audio) {
            file = ctx.message.audio;
        } else if (ctx.message.voice) {
            file = ctx.message.voice;
        } else if (ctx.message.video) {
            file = ctx.message.video;
        }

        const fileUrl = await ctx.api.getFile(file.file_id);
        filePath = await downloadFile(fileUrl.file_path);

        // Распознаем песню
        const songInfo = await recognizeSong(filePath);
        
        if (!songInfo) {
            await ctx.reply('К сожалению, не удалось распознать песню 😔');
            return;
        }

        await ctx.reply(
            `🎧 <b>НАЙДЕНА ПЕСНЯ:</b>
🎵<b>${songInfo.title.toUpperCase()}</b>
👨‍🎤 <b>${songInfo.artist.toUpperCase()}</b>

Ищу аккорды...`,
            { parse_mode: 'HTML' }
        );

        // Получаем аккорды
        try {
            const chordInfo = await getChordInfo(songInfo.title, songInfo.artist, songInfo);
            
            if (!chordInfo) {
                return await ctx.reply('К сожалению, аккорды для этой песни не найдены 😔',
                    { parse_mode: 'HTML' }
                );
            }

            if (chordInfo.formatted && chordInfo.analysis) {
                await ctx.reply(
                    '🎵 <b>Текст песни с аккордами:</b>\n\n' +
                    chordInfo.formatted,
                    { parse_mode: 'HTML' }
                );

                await ctx.reply(
                    chordInfo.analysis,
                    { parse_mode: 'HTML' }
                );
            }

        } catch (error) {
            console.error('Error getting chords:', error);
            await ctx.reply('К сожалению, не удалось найти аккорды для этой песни 😔');
        }

    } catch (error) {
        console.error('Error processing message:', error);
        await ctx.reply('Произошла ошибка при обработке файла 😔');
    } finally {
        // Гарантированное удаление файла после обработки
        if (filePath) {
            deleteFile(filePath);
        }
    }
});

// Запуск бота
bot.start();
console.log('Bot started successfully!');
