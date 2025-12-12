import fs from 'fs';
import path from 'path';

// === ЛЕГКОВЕСНАЯ КОНФИГУРАЦИЯ ===
const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.API_KEY_CURRENT || '';
const MODEL = 'deepseek-lite'; // Самая легковесная модель
const MAX_TOKENS = 200; // Минимум токенов
const TEMPERATURE = 0.3; // Меньше креативности = меньше токенов
const DELAY_BETWEEN_REQUESTS = 3000; // 3 секунды между запросами
const MAX_RETRIES = 3; // Меньше попыток
const TOPICS_FILE = 'topics.txt';
const POSTS_DIR = 'src/content/posts';
// === КОНЕЦ КОНФИГУРАЦИИ ===

// Проверка API ключа
if (!API_KEY) {
    console.error("❌ API ключ не найден! Установите DEEPSEEK_API_KEY");
    process.exit(1);
}

console.log(`🚀 Легковесная генерация через DeepSeek (${MODEL})`);
console.log(`🔑 Ключ: ...${API_KEY.slice(-4)}`);

// Функция задержки
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция безопасной генерации с минимальной нагрузкой
async function generateLightContent(prompt) {
    const baseUrl = 'https://api.deepseek.com/v1';
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`📡 Попытка ${attempt}/${MAX_RETRIES}...`);
            
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [{ role: "user", content: prompt.trim() }],
                    temperature: TEMPERATURE,
                    max_tokens: MAX_TOKENS,
                    stream: false
                })
            });

            // Проверяем статус
            if (response.status === 429) {
                console.log(`⚠️  Лимит превышен. Жду 10 секунд...`);
                await sleep(10000);
                continue;
            }
            
            if (response.status === 402) {
                console.log(`💳 Требуется оплата. Проверьте баланс.`);
                throw new Error("Payment Required");
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log(`❌ HTTP ${response.status}: ${errorText}`);
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";
            
            console.log(`✅ Получено ${content.length} символов`);
            return content;
            
        } catch (error) {
            console.log(`⚠️  Ошибка: ${error.message}`);
            
            if (attempt === MAX_RETRIES) {
                throw error;
            }
            
            // Экспоненциальная задержка
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`⏳ Жду ${waitTime}ms перед повторной попыткой...`);
            await sleep(waitTime);
        }
    }
}

// Простая функция создания slug
function createSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9а-яё\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Генерация одной статьи (минимальная версия)
async function generateArticle(topic) {
    console.log(`📝 Генерирую статью: "${topic}"`);
    
    // Очень простой промпт для минимального потребления
    const prompt = `Краткая статья (150-200 слов) на тему: "${topic}"
    
Формат ответа:
# Заголовок
Краткое введение (1-2 предложения)

## Основная часть
Основной контент (2-3 абзаца)

## Заключение
Выводы (1 абзац)

Ответ строго в формате Markdown без дополнительных пояснений.`;

    try {
        const content = await generateLightContent(prompt);
        
        // Пауза после каждого запроса
        console.log(`⏳ Пауза ${DELAY_BETWEEN_REQUESTS}ms...`);
        await sleep(DELAY_BETWEEN_REQUESTS);
        
        return content;
    } catch (error) {
        console.log(`❌ Не удалось сгенерировать статью: ${error.message}`);
        return null;
    }
}

// Создание файла статьи
async function saveArticle(topic, content) {
    try {
        // Создаем директорию если её нет
        await fs.promises.mkdir(POSTS_DIR, { recursive: true });
        
        // Создаем slug для имени файла
        const slug = createSlug(topic) || `article-${Date.now()}`;
        const filename = path.join(POSTS_DIR, `${slug}.md`);
        
        // Простой frontmatter
        const frontmatter = `---
title: "${topic}"
description: "Статья о ${topic.toLowerCase()}"
pubDate: "${new Date().toISOString().split('T')[0]}"
author: "SEO Generator"
---
`;

        // Сохраняем файл
        await fs.promises.writeFile(filename, frontmatter + content, 'utf-8');
        console.log(`💾 Статья сохранена: ${filename}`);
        return filename;
        
    } catch (error) {
        console.log(`❌ Ошибка сохранения: ${error.message}`);
        return null;
    }
}

// Основная функция
async function main() {
    console.log("🚀 Запуск легковесной генерации...");
    
    try {
        // Читаем темы
        const topicsContent = await fs.promises.readFile(TOPICS_FILE, 'utf-8');
        const topics = topicsContent
            .split(/\r?\n/)
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0);
        
        if (topics.length === 0) {
            console.log("📭 Файл topics.txt пуст");
            return;
        }
        
        console.log(`📋 Найдено тем: ${topics.length}`);
        
        // Обрабатываем только ПЕРВУЮ тему для теста
        const topic = topics[0];
        console.log(`🎯 Обрабатываю тему: "${topic}"`);
        
        // Генерируем статью
        const content = await generateArticle(topic);
        
        if (content && content.length > 50) {
            // Сохраняем статью
            const savedFile = await saveArticle(topic, content);
            if (savedFile) {
                console.log(`🎉 Успешно! Статья создана: ${savedFile}`);
            }
        } else {
            console.log("❌ Статья пустая или слишком короткая");
        }
        
    } catch (error) {
        console.log(`💥 Критическая ошибка: ${error.message}`);
        process.exit(1);
    }
}

// Запуск
main().catch(error => {
    console.log(`💥 Фатальная ошибка: ${error.message}`);
    process.exit(1);
});
