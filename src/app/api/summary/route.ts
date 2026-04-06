import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { messages, level, theme } = await req.json();
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json({
                corrections: [],
                goodPhrases: ["Great effort today!"],
                overallComment: "You did a great job! Keep practicing every day.",
                turnCount: messages.filter((m: any) => m.role === 'user').length,
                rating: 4,
            });
        }

        const userMessages = messages.filter((m: any) => m.role === 'user');
        const turnCount = userMessages.length;

        if (turnCount === 0) {
            return NextResponse.json({
                corrections: [],
                goodPhrases: [],
                overallComment: "Session ended. Start speaking next time for a full review!",
                turnCount: 0,
                rating: 3,
            });
        }

        const conversationText = messages
            .map((m: any) => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.content}`)
            .join('\n');

        const prompt = `You are an expert English teacher reviewing a conversation between a teacher and a ${level} student on the topic: "${theme}".

CONVERSATION:
${conversationText}

TASK: Analyze ONLY the student's responses and return a JSON object with:
1. "corrections": Array of up to 3 grammar/vocabulary mistakes (empty array if none found). Each item: {"wrong": "...", "correct": "...", "explanation": "..."}
2. "goodPhrases": Array of up to 3 impressive phrases or words the student used well (empty array if none)
3. "overallComment": One encouraging sentence (max 20 words) summarizing their performance
4. "turnCount": ${turnCount} (the number)
5. "rating": A number from 1-5 based on overall performance

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no code blocks, no explanation
- If student made no mistakes, "corrections" must be []
- Be encouraging and constructive
- "overallComment" must be positive and motivating

JSON:`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "nvidia/nemotron-3-nano-30b-a3b:free",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.5,
            }),
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message || "OpenRouter Error");

        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid JSON from AI");

        const parsed = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
            corrections: parsed.corrections || [],
            goodPhrases: parsed.goodPhrases || [],
            overallComment: parsed.overallComment || "Great effort today! Keep it up.",
            turnCount: parsed.turnCount || turnCount,
            rating: Math.min(5, Math.max(1, parsed.rating || 3)),
        });

    } catch (error: any) {
        console.error("Summary API Error:", error.message);
        return NextResponse.json({
            corrections: [],
            goodPhrases: [],
            overallComment: "Great effort today! Keep practicing!",
            turnCount: 0,
            rating: 3,
        });
    }
}
