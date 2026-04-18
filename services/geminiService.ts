import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const checkPlagiarism = async (content: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Act as a senior editor and plagiarism checker for a music and entertainment magazine. 
            Analyze the following article content for any signs of AI generation, plagiarism, or lack of originality.
            Be concise. Provide a score from 0-100 indicating originality (100 is fully original).
            Format the response as a JSON object with 'score' (number) and 'feedback' (string).
            
            Article Content:
            ${content}
            `
        });
        
        const rawText = response.text;
        
        let parsed;
        try {
            // Strip out markdown formatting if returned
            const cleanText = rawText.replace(/```json\n?|\n?```/g, '').trim();
            parsed = JSON.parse(cleanText);
        } catch (e) {
            console.error("Failed to parse Gemini response", e);
            parsed = { score: 0, feedback: "Analysis failed due to unexpected format." };
        }
        
        return parsed;
    } catch (e) {
        console.error("Error checking plagiarism:", e);
        return { score: 0, feedback: "Service unavailable." };
    }
};
