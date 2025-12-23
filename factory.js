import fs from 'fs';
import path from 'path';

// === КОНФИГУРАЦИЯ ===
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = 'deepseek-chat';
const MAX_TOKENS = 600;
const BATCH_SIZE = 2; // Генерируем по 2 статьи за раз
const DELAY_MS = 2000;
// === КОНЕЦ КОНФИГУРАЦИИ ===

console.log("=====================================");
console.log("🤖 DEEPSEEK CONTENT GENERATOR");
console.log("=====================================");

// Проверка API ключа
if (!API_KEY) {
    console.error("❌ ОШИБКА: DEEPSEEK_API_KEY не найден!");
    console.error("💡 Перейдите в Settings → Secrets and variables → Actions");
    console.error("💡 Добавьте secret: DEEPSEEK_API_KEY");
    process.exit(1);
}

console.log(`✅ API ключ установлен`);
console.log(`🚀 Модель: ${MODEL}`);
console.log(`📊 Batch size: ${BATCH_SIZE}`);

// Функция создания безопасного slug
function createSlug(text) {
    // Транслитерация
    const translit = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
        'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
        'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
        'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
    };
    
    let result = text.toLowerCase();
    
    // Применяем транслитерацию
    for (let [rus, eng] of Object.entries(translit)) {
        const escaped = rus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), eng);
    }
    
    // Очистка и форматирование
    result = result.replace(/\s+/g, '-');
    result = result.replace(/[^a-z0-9\-]/g, '');
    result = result.replace(/-+/g, '-');
    result = result.replace(/^-|-$/g, '');
    
    // Если пустой - генерируем случайный
    return result || 'article-' + Math.floor(Date.now() / 1000);
}

// Функция генерации через DeepSeek API
async function generateContent(prompt) {
    try {
        console.log("📡 Отправка запроса...");
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: "user", content: prompt.trim() }],
                max_tokens: MAX_TOKENS,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        console.log(`✅ Получено ${content.length} символов`);
        return content;
        
    } catch (error) {
        console.error(`❌ Ошибка API: ${error.message}`);
        return null;
    }
}

// Функция сохранения статьи
async function saveArticle(topic, content) {
    try {
        console.log(`💾 Сохраняю статью: "${topic}"`);
        
        // Создаем директорию если её нет
        const postsDir = 'src/content/posts';
        await fs.promises.mkdir(postsDir, { recursive: true });
        
        // Создаем имя файла
        const slug = createSlug(topic);
        const filename = path.join(postsDir, `${slug}.md`);
        
        // Создаем frontmatter
        const frontmatter = `---
title: "${topic}"
description: "Подробное руководство по ${topic.toLowerCase()}. Полезная информация и практические рекомендации."
pubDate: "${new Date().toISOString().split('T')[0]}"
author: "AI Content Generator"
---

`;

        // Проверяем и сохраняем контент
        if (content && content.length > 100) {
            await fs.promises.writeFile(filename, frontmatter + content, 'utf-8');
            console.log(`✅ Статья сохранена: ${filename}`);
            return filename;
        } else {
            console.error(`❌ Контент слишком короткий для ${filename}`);
            return null;
        }
        
    } catch (error) {
        console.error(`❌ Ошибка сохранения: ${error.message}`);
        return null;
    }
}

// Основная функция генерации
async function main() {
    console.log("🚀 Начинаю генерацию контента...");
    
    try {
        // Читаем темы
        console.log("📂 Читаю topics.txt...");
        
        let topics = [];
        if (fs.existsSync('topics.txt')) {
            const topicsContent = await fs.promises.readFile('topics.txt', 'utf-8');
            topics = topicsContent
                .split(/\r?\n/)
                .map(topic => topic.trim())
                .filter(topic => topic.length > 0);
        }
        
        // Если нет topics.txt - создаем тестовые темы
        if (topics.length === 0) {
            console.log("📝 Создаю тестовые темы...");
            topics = [
                "Как выбрать автомобиль в 2024 году",
                "Ремонт двигателя: основные принципы",
                "Советы по экономии топлива"
            ];
            
            // Сохраняем тестовые темы
            fs.writeFileSync('topics.txt', topics.join('\n'));
        }
        
        console.log(`📋 Найдено тем: ${topics.length}`);
        
        // Обрабатываем ограниченное количество тем
        const topicsToProcess = topics.slice(0, BATCH_SIZE);
        console.log(`🎯 Буду обрабатывать: ${topicsToProcess.length} тем`);
        
        // Генерируем статьи
        for (let i = 0; i < topicsToProcess.length; i++) {
            const topic = topicsToProcess[i];
            console.log(`\n📝 Тема ${i + 1}/${topicsToProcess.length}: "${topic}"`);
            
            // Создаем промпт
            const prompt = `Напиши SEO-оптимизированную статью на тему: "${topic}"

Требования:
- Объем: 300-500 слов
- Структура с заголовками
- Полезный контент
- Русский язык

Ответ строго в формате Markdown.`;
            
            // Генерируем контент
            const content = await generateContent(prompt);
            
            if (content) {
                // Сохраняем статью
                const savedFile = await saveArticle(topic, content);
                if (savedFile) {
                    console.log(`🎉 Успешно! Статья создана.`);
                }
                
                // Пауза между запросами (кроме последнего)
                if (i < topicsToProcess.length - 1) {
                    console.log(`⏳ Пауза ${DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            } else {
                console.error(`❌ Не удалось сгенерировать статью`);
            }
        }
        
        console.log("\n=====================================");
        console.log("✅ ГЕНЕРАЦИЯ ЗАВЕРШЕНА!");
        console.log(`Обработано тем: ${topicsToProcess.length}`);
        console.log("=====================================");
        
    } catch (error) {
        console.error(`💥 КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
        process.exit(1);
    }
}

// Запуск генератора
main();
