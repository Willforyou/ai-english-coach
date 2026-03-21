import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text } = await req.json();
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json({
                error: "Teacher Warning: Please enter your OpenRouter API Key in the `.env.local` file!"
            }, { status: 401 });
        }

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        const systemPrompt = `
You are a translation assistant. Your ONLY job is to translate English to Traditional Chinese (zh-TW).

RULES:
1. Translate ONLY the user's input text
2. Return ONLY the Chinese translation
3. NO explanations, NO notes, NO extra text
4. If input is "Hello, how are you?", output should be "你好，你好嗎？"

Translate this English text to Traditional Chinese:`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "nvidia/nemotron-3-nano-30b-a3b:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.1,
            }),
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || "OpenRouter Error");
        }

        const translation = data.choices[0].message.content.trim();
        return NextResponse.json({ translation });
    } catch (error: any) {
        console.error("Translation API Error:", error.message);
        return NextResponse.json({ error: error.message || "Failed to translate" }, { status: 500 });
    }
}
