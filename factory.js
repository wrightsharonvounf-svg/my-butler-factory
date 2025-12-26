import fs from 'fs';
import path from 'path';

// === ПРАВИЛЬНАЯ КОНФИГУРАЦИЯ ===
// ИСПОЛЬЗУЕМ ТОЛЬКО DEEPSEEK_API_KEY
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = 'deepseek-chat';
const MAX_TOKENS = 500;
const BATCH_SIZE = 1; // Начнем с одной статьи
const DELAY_MS = 2000;
// === КОНЕЦ КОНФИГУРАЦИИ ===

console.log("=====================================");
console.log("🤖 DEEPSEEK CONTENT GENERATOR v2.0");
console.log("=====================================");

// Проверка API ключа - теперь правильно!
if (!API_KEY) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: DEEPSEEK_API_KEY не найден!");
    console.error("💡 Установите переменную окружения:");
    console.error("   export DEEPSEEK_API_KEY=sk-ваш_новый_ключ");
    console.error("💡 Или добавьте в GitHub Secrets");
    process.exit(1);
}

console.log(`✅ API ключ установлен (длина: ${API_KEY.length})`);
console.log(`🚀 Модель: ${MODEL}`);
console.log(`📊 Batch size: ${BATCH_SIZE}`);

// Функция создания безопасного slug
function createSlug(text) {
    const translit = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
        'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
        'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
        'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
    };
    
    let result = text.toLowerCase();
    
    for (let [rus, eng] of Object.entries(translit)) {
        const escaped = rus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), eng);
    }
    
    result = result.replace(/\s+/g, '-');
    result = result.replace(/[^a-z0-9\-]/g, '');
    result = result.replace(/-+/g, '-');
    result = result.replace(/^-|-$/g, '');
    
    return result || 'article-' + Math.floor(Date.now() / 1000);
}

// Функция генерации через DeepSeek API
async function generateWithDeepSeek(prompt) {
    try {
        console.log("📡 Отправка запроса к DeepSeek...");
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`, // ПРАВИЛЬНЫЙ ЗАГОЛОВОК!
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
        
        const postsDir = 'src/content/posts';
        await fs.promises.mkdir(postsDir, { recursive: true });
        
        const slug = createSlug(topic);
        const filename = path.join(postsDir, `${slug}.md`);
        
        const frontmatter = `---
title: "${topic}"
description: "Подробное руководство по ${topic.toLowerCase()}"
pubDate: "${new Date().toISOString().split('T')[0]}"
author: "DeepSeek Generator"
---

`;

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
        // Проверяем topics.txt
        console.log("📂 Проверяю topics.txt...");
        
        if (!fs.existsSync('topics.txt')) {
            console.log("📝 Создаю тестовый topics.txt...");
            const testTopics = "Тестовая статья для генерации\nПример SEO контента";
            fs.writeFileSync('topics.txt', testTopics);
        }
        
        const topicsContent = await fs.promises.readFile('topics.txt', 'utf-8');
        const topics = topicsContent
            .split(/\r?\n/)
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0);
        
        if (topics.length === 0) {
            console.error("❌ topics.txt пуст!");
            process.exit(1);
        }
        
        console.log(`📋 Найдено тем: ${topics.length}`);
        
        // Обрабатываем одну тему для теста
        const topic = topics[0];
        console.log(`\n📝 Генерирую: "${topic}"`);
        
        const prompt = `Краткая SEO статья (200-300 слов) о: "${topic}". Только Markdown.`;
        
        const content = await generateWithDeepSeek(prompt);
        
        if (content) {
            const savedFile = await saveArticle(topic, content);
            if (savedFile) {
                console.log(`🎉 УСПЕХ! Статья создана.`);
            }
        } else {
            console.error(`❌ Не удалось сгенерировать статью`);
        }
        
        console.log("\n=====================================");
        console.log("✅ ГЕНЕРАЦИЯ ЗАВЕРШЕНА!");
        console.log("=====================================");
        
    } catch (error) {
        console.error(`💥 ОШИБКА: ${error.message}`);
        process.exit(1);
    }
}

// Запуск генератора
main();
