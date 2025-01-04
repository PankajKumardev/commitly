import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define the model
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Generates a message using the Gemini API based on a provided prompt.
 * @param prompt - The prompt to send to Gemini.
 * @returns The generated message text or null in case of an error.
 */
export async function generateGeminiMessage(prompt: string): Promise<string | null> {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error with Gemini API:', error);
    return null; // Return null if there's an error
  }
}
