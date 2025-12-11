import fs from 'fs';
import path from 'path';

// === КОНФИГУРАЦИЯ ДЛЯ БЕСПЛАТНОЙ МОДЕЛИ ===
const MODEL_CHOICE = 'deepseek-lite'; // Бесплатная модель
const THREAD_ID = parseInt(process.env.THREAD_ID, 10) || 1;
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.API_KEY_CURRENT || '';
const TOPICS_FILE = 'topics.txt';
const MAX_TOKENS = 500; // Меньше токенов для бесплатной версии
// === КОНЕЦ КОНФИГУРАЦИИ ===

// Проверка API ключа
if (!apiKey) {
    throw new Error(`[Поток #${THREAD_ID}] Не был предоставлен API-ключ!`);
}

console.log(`🚀 [Поток #${THREAD_ID}] Использую БЕСПЛАТНУЮ модель DeepSeek (${MODEL_CHOICE}) с ключом ...${apiKey.slice(-4)}`);

// Функция для генерации контента через бесплатную модель DeepSeek
async function generateWithDeepSeekLite(prompt, maxRetries = 3) {
    const baseUrl = 'https://api.deepseek.com/v1';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Попытка ${attempt}/${maxRetries}] Отправка запроса...`);
            
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL_CHOICE, // Используем бесплатную модель
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: MAX_TOKENS
                })
            });

            console.log(`Статус ответа: ${response.status}`);
            
            if (response.status === 402) {
                throw new Error("Payment Required - возможно, нужна активация аккаунта");
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
            
        } catch (error) {
            console.log(`[!] [Поток #${THREAD_ID}] Ошибка: ${error.message}`);
            if (attempt === maxRetries) {
                throw new Error(`Не удалось получить ответ после ${maxRetries} попыток: ${error.message}`);
            }
            // Ждем перед повторной попыткой
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// Упрощенный промпт для бесплатной модели
async function generatePost(topic) {
    console.log(`[+] [Поток #${THREAD_ID}] Генерирую статью на тему: ${topic}`);
    
    // Упрощенный промпт для бесплатной модели
    const prompt = `SEO статья на тему: "${topic}"

Требования:
- Объем: 200-300 слов
- Структура с 2-3 заголовками
- Ключевые слова в тексте
- Полезный контент
- Русский язык

Ответ в формате Markdown с заголовками.`;

    try {
        const content = await generateWithDeepSeekLite(prompt);
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
            console.log(`Превью: ${content.substring(0, 200)}...`);
            
            // Сохраняем статью (минимальная реализация)
            console.log(`[+] [Поток #${THREAD_ID}] Статья готова к сохранению`);
            
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
