import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { level, theme } = await req.json();
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json({
                vocabulary: ["Key Word 1", "Key Word 2"],
                phrases: ["Useful Phrase 1", "Useful Phrase 2"]
            });
        }

        const systemPrompt = `
      You are an expert English Curriculum Designer. 
      Student Level: ${level}
      Theme: ${theme}

      TASK: Provide lesson materials to help the student prepare for a conversation.
      
      OUTPUT FORMAT (JSON):
      {
        "vocabulary": ["word1", "word2", "word3", "word4", "word5"],
        "phrases": ["phrase1", "phrase2", "phrase3"]
      }
    `;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemma-3-4b-it:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Generate the lesson materials." }
                ]
            }),
        });

        const data = await response.json();
        console.log("OpenRouter Materials Response:", data);

        if (data.error) {
            throw new Error(data.error.message || "OpenRouter Error");
        }

        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error("Materials API Error:", error.message);
        return NextResponse.json({
            vocabulary: [],
            phrases: [],
            error: error.message
        }, { status: 500 });
    }
}
