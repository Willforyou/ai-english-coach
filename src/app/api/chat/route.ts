import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { messages, level, theme } = await req.json();
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json({
                content: "Teacher Warning: Please enter your OpenRouter API Key in the `.env.local` file to start the lesson!"
            });
        }

        const systemPrompt = `
      You are an expert AI English Teacher conducting a VOICE-ONLY role-play session.
      Student Level: ${level}
      Current Theme: ${theme}
      
      TEACHING STYLE: ROLE-PLAY & SOCRATIC QUESTIONING
      1. Stay in character based on the theme (e.g., if it's a Coffee Shop, you are the barista).
      2. Maximize Student Talk Time: Always end your turn with an open-ended question to keep the student talking.
      3. Focus on ${level} level: 
         - Beginner: Use CEFR A1 vocabulary ONLY. Max 1 short sentence (under 12 words). Speak very clearly.
         - Intermediate: Natural, moderate speed, standard vocabulary. 2-3 sentences.
         - Advanced: Fast, complex sentences, idioms.
      4. Spoken Correction: If the student makes a mistake, acknowledge it naturally in your response (e.g., "Ah, you *went* to the shop? Great!").
      
      CRITICAL RULES:
      1. This is a voice call. 
         - If Beginner: EXACTLY 1 short sentence ending in a question.
         - Otherwise: Keep responses CONCISE (2-3 sentences maximum).
      2. Speak naturally/telephonically. Avoid all markdown (no bold, no lists).
      3. Encourage and praise the student's effort.
    `;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "liquid/lfm-2.5-1.2b-instruct:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages
                ],
            }),
        });

        const data = await response.json();
        console.log("OpenRouter Chat Response:", data);

        if (data.error) {
            throw new Error(data.error.message || "OpenRouter Error");
        }

        return NextResponse.json({ content: data.choices[0].message.content });
    } catch (error: any) {
        console.error("Chat API Error:", error.message);
        return NextResponse.json({ error: error.message || "Failed to connect to AI Teacher" }, { status: 500 });
    }
}
