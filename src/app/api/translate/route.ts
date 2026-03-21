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
      You are a translation assistant for an English learning app.
      TASK: Translate the following English sentence into clear, natural Traditional Chinese (zh-TW).
      CONTEXT: This is what an AI English teacher just said to a beginner student.
      OUTPUT: Return ONLY the translated text. Do not include any explanations or extra characters.
    `;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-flash-exp:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
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
