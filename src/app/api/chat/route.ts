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

        const isFreeTalk = theme === 'Free Talk';

        const systemPrompt = isFreeTalk
            ? `
      You are a friendly AI English conversation partner conducting a FREE TALK session.
      Student Level: ${level}
      
      TEACHING STYLE: NATURAL CONVERSATION
      1. Be a friendly conversation partner. No role-playing, just natural chat.
      2. Topics can be anything: hobbies, weather, food, travel, movies, daily life, etc.
      3. Maximize Student Talk Time: Always end with an open-ended question.
      4. Focus on ${level} level:
         - Beginner: Use CEFR A1 vocabulary ONLY. Max 1 short sentence (under 12 words).
         - Intermediate: Natural, moderate speed. 2-3 sentences.
         - Advanced: Fast, complex sentences, idioms.
      5. Spoken Correction: If the student makes a mistake, acknowledge it naturally.
      
      CRITICAL RULES:
      1. One Question Only per turn.
      2. Response Length:
         - Beginner: EXACTLY one short sentence (max 10 words). End with a simple question.
         - Intermediate/Advanced: CONCISE (1-2 sentences). End with an open-ended question.
      3. No Formatting: This is voice. Forbidden: markdown, bold, lists, asterisks.
      4. Be encouraging and patient.
    `
            : `
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
      1. One Question Only: NEVER ask more than one question per turn. Use exactly ONE question mark (?) in your entire response.
      2. Response Length:
         - Beginner: EXACTLY one short sentence (max 10 words). Must end with a simple question.
         - Intermediate/Advanced: CONCISE (1-2 sentences). End with a single open-ended question.
      3. No Formatting: This is voice. Forbidden: markdown, bold, lists, asterisks.
      4. Speak naturally. Be encouraging. 
    `;

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
                    ...messages
                ],
            }),
        });

        const data = await response.json();
        console.log("OpenRouter Chat Response:", data);

        if (data.error) {
            throw new Error(data.error.message || "OpenRouter Error");
        }

        const assistantResponse = data.choices[0].message.content;

        let suggestedResponses: string[] = [];
        if (level === 'Beginner') {
            const responsePrompt = `You are an English teacher assistant. The teacher just asked: "${assistantResponse}"

Generate 3-4 simple response options a beginner student could say next.

RULES:
1. Each response must be simple (CEFR A1 level, max 6 words)
2. Return ONLY a JSON array of strings
3. No explanations, no markdown

Examples:
- For "What would you like to drink?": ["I want water.", "Coffee, please.", "How much is it?", "I don't know."]
- For "Where are you from?": ["I am from Taiwan.", "I live in Taipei.", "And you?", "I don't understand."]

Respond with JSON array only:`;

            try {
                const hintRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "nvidia/nemotron-3-nano-30b-a3b:free",
                        messages: [{ role: "user", content: responsePrompt }],
                        temperature: 0.7,
                    }),
                });
                const hintData = await hintRes.json();
                if (hintData.choices?.[0]?.message?.content) {
                    const hintContent = hintData.choices[0].message.content;
                    const jsonMatch = hintContent.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        suggestedResponses = JSON.parse(jsonMatch[0]);
                    }
                }
            } catch (e) {
                console.error("Failed to generate hints:", e);
            }
        }

        return NextResponse.json({ 
            content: assistantResponse,
            responses: suggestedResponses
        });
    } catch (error: any) {
        console.error("Chat API Error:", error.message);
        return NextResponse.json({ error: error.message || "Failed to connect to AI Teacher" }, { status: 500 });
    }
}
