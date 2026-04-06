import { NextResponse } from 'next/server';

const PERSONAS: Record<string, { name: string; role: string }> = {
    "Coffee Shop Ordering":     { name: "Alex",       role: "a friendly barista at a cozy café" },
    "Job Interview":            { name: "Sarah Chen",  role: "an HR manager at a tech company" },
    "Airport Check-in":         { name: "James",       role: "a helpful airline check-in agent" },
    "Doctor Appointment":       { name: "Dr. Williams",role: "a friendly general physician" },
    "Supermarket Shopping":     { name: "Tom",         role: "a helpful supermarket staff member" },
    "Daily Routine":            { name: "Emma",        role: "a friendly conversation buddy" },
    "Travel Planning":          { name: "Lisa",        role: "an experienced travel consultant" },
    "Self-Introduction":        { name: "Mike",        role: "a friendly networking event host" },
    "Business Negotiation":     { name: "Ms. Parker",  role: "an experienced business executive" },
    "Talking about Hobbies":    { name: "Jamie",       role: "a curious and enthusiastic friend" },
    "Ordering at a Restaurant": { name: "Sofia",       role: "a professional restaurant server" },
    "Asking for Directions":    { name: "David",       role: "a helpful local resident" },
    "Check-in at a Hotel":      { name: "Rachel",      role: "a professional hotel front desk agent" },
    "Free Talk":                { name: "Chris",       role: "a friendly English conversation partner" },
};

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
        const persona = PERSONAS[theme] || { name: "Alex", role: "a friendly English teacher" };

        const personaIntro = `Your name is ${persona.name} and you are ${persona.role}.`;

        const systemPrompt = isFreeTalk
            ? `You are ${persona.name}, a friendly English conversation partner.
${personaIntro}

TEACHING STYLE: NATURAL CONVERSATION
1. Be a genuine conversation partner — warm, curious, encouraging.
2. Topics can be anything the student brings up.
3. Maximize Student Talk Time: Always end with a single open-ended question.
4. Adapt to ${level} level:
   - Beginner: CEFR A1 vocabulary ONLY. 1-2 very simple sentences. DO NOT just repeat what the student said. Move the conversation forward.
   - Intermediate: Natural pace, 2-3 sentences.
   - Advanced: Complex sentences, idioms welcome.
5. If the student makes a mistake, weave the correction naturally into your reply.

CRITICAL RULES:
1. ONE question per turn only — exactly one "?" in your response.
2. Response Length & Style:
   - Beginner: Keep it under 20 words. Give a short, simple response, then ask a NEW simple question. Do not just say "Is that so?" or repeat their words.
   - Intermediate/Advanced: CONCISE (1-2 sentences) + one open-ended question.
3. No Formatting: voice only. No markdown, bold, lists, asterisks.
4. Be warm and encouraging at all times.`
            : `You are ${persona.name}, ${persona.role}. You are conducting a voice role-play English lesson.
${personaIntro}

TEACHING STYLE: IMMERSIVE ROLE-PLAY
1. Stay fully in character as ${persona.name}. Do not break character.
2. The theme/scenario is: "${theme}".
3. Maximize Student Talk Time: Always end your turn with a single open-ended question.
4. Adapt to ${level} level:
   - Beginner: CEFR A1 vocabulary ONLY. 1-2 very simple sentences. DO NOT frame their answer as a question (e.g., "Oh, you like coffee?"). Move the scenario forward.
   - Intermediate: Natural pace, standard vocabulary. 2-3 sentences.
   - Advanced: Fast, complex sentences, idioms.
5. If the student makes a mistake, acknowledge it naturally (e.g., "Ah, you *went* there? Interesting!").

CRITICAL RULES:
1. One Question Only: NEVER ask more than one question. Use exactly ONE "?" in your entire response.
2. Response Length & Style:
   - Beginner: Keep it under 20 words. Provide a short piece of new information, then ask a NEW direct question to continue the role-play.
   - Intermediate/Advanced: CONCISE (1-2 sentences). End with a single open-ended question.
3. No Formatting: voice only. No markdown, bold, lists, asterisks.
4. Speak naturally. Be encouraging and patient.`;

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

        if (data.error) throw new Error(data.error.message || "OpenRouter Error");

        const assistantResponse = data.choices[0].message.content;

        let suggestedResponses: string[] = [];
        if (level === 'Beginner') {
            const responsePrompt = `You are an English teacher assistant. The teacher just said: "${assistantResponse}"

Generate 3-4 simple response options a beginner student (CEFR A1) could say next.

RULES:
1. Each response must be very simple (max 6 words)
2. Return ONLY a JSON array of strings
3. No explanations, no markdown, no code blocks

Example output: ["I want water.", "Coffee, please.", "How much is it?", "I don't know."]

JSON array:`;

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
                    if (jsonMatch) suggestedResponses = JSON.parse(jsonMatch[0]);
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
