import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { level, theme } = await req.json();
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json({
                vocabulary: ["Key Word 1", "Key Word 2"],
                phrases: ["Useful Phrase 1", "Useful Phrase 2"],
                responses: ["Yes, I understand.", "No, I don't understand."]
            });
        }

        const systemPrompt = `
      You are an expert English Curriculum Designer. 
      Student Level: ${level}
      Theme: ${theme}

      TASK: Provide lesson materials for the student.
      
      CONSTRAINTS for Student Level "${level}":
      - If Beginner: Use only very simple words (CEFR A1). Phrases must be 2-4 words long maximum.
      - If Intermediate/Advanced: Natural and professional.

      OUTPUT FORMAT (JSON):
      {
        "vocabulary": ["word1", "word2", "word3", "word4", "word5"],
        "phrases": ["phrase1", "phrase2", "phrase3"],
        "responses": ["simple response 1", "simple response 2", "simple response 3"]
      }
      
      IMPORTANT: "responses" should contain 3-4 simple answer templates that a beginner can use to respond to questions in this theme.
      Examples for different themes:
      - Coffee Shop: "I want a coffee, please.", "How much is this?", "Thank you."
      - Job Interview: "I have experience.", "I can start next week.", "Thank you for asking."
      - Free Talk: "I like it.", "I don't know.", "That's interesting."
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
