import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function generateGeminiMessage(prompt: string): Promise<string | null> {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error with Gemini API:', error);
    return null;
  }
}
