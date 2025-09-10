import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

interface ImageData {
  data: string;
  mimeType: string;
}

export const generateThumbnail = async (prompt: string, images: ImageData[]): Promise<string> => {
  try {
    const imageParts = images.map(image => ({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType,
      },
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          ...imageParts,
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return part.inlineData.data;
        }
      }
    }
    
    throw new Error('AI did not return an image. Please try a different prompt or headshot.');

  } catch (error) {
    console.error("Error generating thumbnail with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the thumbnail.");
  }
};
