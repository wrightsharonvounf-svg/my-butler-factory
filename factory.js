import fs from 'fs';
import path from 'path';

// === DEEPSEEK КОНФИГУРАЦИЯ ===
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = 'deepseek-chat';
const MAX_TOKENS = 800;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 1;
const DELAY_MS = 3000;
// === КОНЕЦ КОНФИГУРАЦИИ ===

console.log("=====================================");
console.log("🤖 DEEPSEEK CONTENT FACTORY");
console.log("=====================================");

// Проверка API ключа
if (!API_KEY) {
    console.error("❌ DEEPSEEK_API_KEY не найден!");
    process.exit(1);
}

console.log(`✅ API ключ установлен (длина: ${API_KEY.length} символов)`);
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
        console.log(`❌ Ошибка API: ${error.message}`);
        return null;
    }
}

// Функция сохранения статьи с подробной отладкой
async function saveArticle(topic, content) {
    try {
        console.log(`🔧 Начинаю сохранение статьи для темы: "${topic}"`);
        
        // Проверяем директорию
        const postsDir = 'src/content/posts';
        console.log(`🔧 Проверяю директорию: ${postsDir}`);
        
        // Создаем директорию если её нет
        try {
            await fs.promises.access(postsDir);
            console.log(`✅ Директория существует`);
        } catch (error) {
            console.log(`🔧 Создаю директорию...`);
            await fs.promises.mkdir(postsDir, { recursive: true });
            console.log(`✅ Директория создана`);
        }
        
        // Создаем имя файла
        const slug = createSlug(topic);
        console.log(`🔧 Создан slug: "${slug}"`);
        
        const filename = path.join(postsDir, `${slug}.md`);
        console.log(`🔧 Полный путь к файлу: ${filename}`);
        
        // Создаем frontmatter
        const frontmatter = `---
title: "${topic}"
description: "Подробное руководство по ${topic.toLowerCase()}. Полезная информация и практические рекомендации."
pubDate: "${new Date().toISOString().split('T')[0]}"
author: "DeepSeek Generator"
---

`;

        // Проверяем контент
        if (!content || content.length < 50) {
            console.log(`❌ Содержимое слишком короткое (${content ? content.length : 0} символов)`);
            return null;
        }
        
        // Сохраняем файл
        console.log(`💾 Сохраняю файл...`);
        await fs.promises.writeFile(filename, frontmatter + content, 'utf-8');
        console.log(`✅ Файл успешно сохранен: ${filename}`);
        
        // Проверяем, что файл создан
        try {
            const stats = await fs.promises.stat(filename);
            console.log(`📊 Размер файла: ${stats.size} байт`);
        } catch (error) {
            console.log(`⚠️ Не удалось проверить файл: ${error.message}`);
        }
        
        return filename;
        
    } catch (error) {
        console.log(`❌ Критическая ошибка сохранения: ${error.message}`);
        console.log(`🔧 Stack trace: ${error.stack}`);
        return null;
    }
}

// Основная функция
async function main() {
    console.log("🚀 Запуск генерации контента...");
    
    try {
        // Читаем темы из файла
        console.log("📂 Читаю topics.txt...");
        const topicsContent = await fs.promises.readFile('topics.txt', 'utf-8');
        const topics = topicsContent
            .split(/\r?\n/)
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0);
        
        if (topics.length === 0) {
            console.log("📭 Файл topics.txt пуст или не найден");
            return;
        }
        
        console.log(`📋 Найдено тем для генерации: ${topics.length}`);
        console.log(`📋 Темы: ${topics.join(', ')}`);
        
        // Обрабатываем темы по batch_size
        const topicsToProcess = topics.slice(0, BATCH_SIZE);
        console.log(`🎯 Буду обрабатывать: ${topicsToProcess.length} тем`);
        
        for (let i = 0; i < topicsToProcess.length; i++) {
            const topic = topicsToProcess[i];
            console.log(`\n📝 Обрабатываю тему ${i + 1}/${topicsToProcess.length}: "${topic}"`);
            
            // Создаем промпт для генерации
            const prompt = `Напиши SEO-оптимизированную статью на тему: "${topic}"

Требования:
- Объем: 400-600 слов
- Структура с заголовками (H1, H2)
- Полезный, информативный контент
- Русский язык

Формат ответа: Только статья в формате Markdown.`;
            
            // Генерируем контент
            const content = await generateWithDeepSeek(prompt);
            
            if (content) {
                console.log(`✅ Контент сгенерирован успешно!`);
                // Сохраняем статью
                const savedFile = await saveArticle(topic, content);
                if (savedFile) {
                    console.log(`🎉 Статья успешно создана и сохранена!`);
                } else {
                    console.log(`❌ Ошибка при сохранении статьи`);
                }
                
                // Пауза между запросами (кроме последнего)
                if (i < topicsToProcess.length - 1) {
                    console.log(`⏳ Пауза ${DELAY_MS}ms перед следующим запросом...`);
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            } else {
                console.log(`❌ Не удалось сгенерировать статью для темы: "${topic}"`);
            }
        }
        
        console.log("\n=====================================");
        console.log("✅ Генерация контента завершена!");
        console.log(`Обработано тем: ${topicsToProcess.length}`);
        console.log("=====================================");
        
    } catch (error) {
        console.log(`💥 Критическая ошибка: ${error.message}`);
        process.exit(1);
    }
}

// Запуск
main();
