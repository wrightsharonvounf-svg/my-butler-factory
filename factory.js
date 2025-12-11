import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// === КОНФИГУРАЦИЯ ===
const MODEL_CHOICE = process.env.MODEL_CHOICE || 'deepseek';
const THREAD_ID = parseInt(process.env.THREAD_ID, 10) || 1;
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.API_KEY_CURRENT || '';
const TOPICS_FILE = 'topics.txt';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1;
const totalThreads = parseInt(process.env.TOTAL_THREADS, 10) || 1;
// === КОНЕЦ КОНФИГУРАЦИИ ===

// Проверка API ключа
if (!apiKey) {
    throw new Error(`[Поток #${THREAD_ID}] Не был предоставлен API-ключ!`);
}

console.log(`🚀 [Поток #${THREAD_ID}] Использую модель DeepSeek напрямую с ключом ...${apiKey.slice(-4)}`);

// Функция для генерации контента через DeepSeek
async function generateWithDeepSeek(prompt, maxRetries = 4) {
    const baseUrl = 'https://api.deepseek.com/v1';
    const model = 'deepseek-chat'; // или 'deepseek-coder' для технического контента
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
            
        } catch (error) {
            console.log(`[!] [Поток #${THREAD_ID}] Ошибка при вызове API. Попытка ${attempt}/${maxRetries}`);
            if (attempt === maxRetries) {
                throw new Error(`Не удалось получить ответ от DeepSeek после ${maxRetries} попыток: ${error.message}`);
            }
            // Ждем перед повторной попыткой
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// Основная функция генерации (упрощенная версия)
async function generatePost(topic) {
    console.log(`[+] [Поток #${THREAD_ID}] Генерирую статью на тему: ${topic}`);
    
    // Создаем промпт для генерации статьи
    const prompt = `Напиши подробную SEO-оптимизированную статью на тему: "${topic}"
    
Требования:
- Объем: 1500-2000 слов
- Структура с заголовками H2 и H3
- Ключевые слова в тексте
- Мета-описание в начале (в формате JSON)
- Читаемый, полезный контент
- Русский язык`;

    try {
        const content = await generateWithDeepSeek(prompt);
        return content;
    } catch (error) {
        console.error(`[!] [Поток #${THREAD_ID}] Ошибка при генерации статьи: ${error.message}`);
        throw error;
    }
}

// Основная функция
async function main() {
    console.log(`[Поток #${THREAD_ID}] Запуск рабочего потока...`);
    
    try {
        // Читаем темы
        const fileContent = await fs.promises.readFile(TOPICS_FILE, 'utf-8');
        const allTopics = fileContent.split(/\r?\n/).map(topic => topic.trim()).filter(Boolean);
        
        if (allTopics.length === 0) {
            console.log(`[Поток #${THREAD_ID}] Файл topics.txt пуст. Завершение.`);
            return;
        }
        
        console.log(`[Поток #${THREAD_ID}] Найдено ${allTopics.length} тем.`);
        
        // Для теста обрабатываем только первую тему
        const topic = allTopics[0];
        try {
            const content = await generatePost(topic);
            console.log(`[+] [Поток #${THREAD_ID}] Статья сгенерирована успешно!`);
            console.log(`Превью первых 200 символов: ${content.substring(0, 200)}...`);
        } catch (error) {
            console.error(`[!] [Поток #${THREAD_ID}] Ошибка при обработке темы "${topic}": ${error.message}`);
        }
        
    } catch (error) {
        console.error(`[Поток #${THREAD_ID}] Критическая ошибка: ${error.message}`);
        process.exit(1);
    }
}

// Запуск
main().catch(error => {
    console.error(`[Поток #${THREAD_ID}] Фатальная ошибка:`, error);
    process.exit(1);
});
