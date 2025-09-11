import React, { useState, useCallback, ChangeEvent, useMemo } from 'react';
import { Header } from './components/Header';
import { ThumbnailDisplay } from './components/ThumbnailDisplay';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { UploadIcon } from './components/icons/UploadIcon';
import { Headshot } from './types';
import { generateThumbnail } from './services/geminiService';

const App: React.FC = () => {
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [textLanguage, setTextLanguage] = useState<string>('English');
  const [textStylingInstructions, setTextStylingInstructions] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | 'both'>('16:9');
  const [mainHeadshot, setMainHeadshot] = useState<Headshot | null>(null);
  const [contextualImages, setContextualImages] = useState<Headshot[]>([]);
  
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdatingText, setIsUpdatingText] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentThumbnail = useMemo(() => {
    if (historyIndex >= 0 && historyIndex < history.length) {
      return history[historyIndex];
    }
    return null;
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, isMain: boolean) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    const newHeadshots: Headshot[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    if (isMain && newHeadshots.length > 0) {
      if (mainHeadshot) {
        URL.revokeObjectURL(mainHeadshot.previewUrl);
      }
      setMainHeadshot(newHeadshots[0]);
    } else {
      setContextualImages(prev => [...prev, ...newHeadshots]);
    }
    event.target.value = ''; // Reset file input
  };
  
  const removeImage = (idToRemove: string, isMain: boolean) => {
    if (isMain) {
       if (mainHeadshot) {
           URL.revokeObjectURL(mainHeadshot.previewUrl);
           setMainHeadshot(null);
       }
    } else {
        setContextualImages(prev => {
            const imageToRemove = prev.find(img => img.id === idToRemove);
            if (imageToRemove) {
                URL.revokeObjectURL(imageToRemove.previewUrl);
            }
            return prev.filter(img => img.id !== idToRemove);
        });
    }
  };

  const getPrompt = () => {
      const basePrompt = `You are an expert YouTube thumbnail designer tasked with creating a viral, eye-catching thumbnail.
Video Title: "${videoTitle}"
Text Language for Thumbnail: "${textLanguage}"
The user has provided a primary headshot (the first image) and several optional contextual images.`;

      const instructions = {
          subjectIntegration: `**Subject Integration**: Extract the person/main subject from the main uploaded image. Do not keep the original crop or background. Seamlessly integrate the subject into a NEWLY generated, dynamic background scene. You can reposition, resize, or slightly angle the person to fit the new scene.`,
          fullBleedBackground: `**Full-Bleed Background**: The background MUST be a complete, visually rich scene that extends to every edge of the frame. It should be directly inspired by the video title and user's instructions. The final image's aspect ratio MUST be EXACTLY ${aspectRatio === 'both' ? '16:9' : aspectRatio}. Do not add letterboxing, pillarboxing, or any filler bars.`,
          contextualImages: `**Contextual Images**: If other images are provided, use them as smaller elements, inspiration for background details, or layered effects within the new scene.`,
          mainText: `**Main Text**: Add the video title as large, high-contrast, and easily readable text. The text MUST be in ${textLanguage}. CRITICAL: The text on the thumbnail MUST be rendered EXACTLY as follows: "${videoTitle}". Do not translate, alter, or misspell it.`,
          subtitleText: subtitle.trim() ? `**Subtitle Text**: Add the following text as a smaller, stylish subtitle: "${subtitle}". Place it tastefully where it doesn't obstruct the main subject or title.` : '',
          textStyling: textStylingInstructions.trim() ? `**Text Style**: Apply the following style and color instructions to ALL text on the thumbnail: "${textStylingInstructions}"` : '',
          creativeDirection: customInstructions.trim() ? `**User's Creative Direction**: The user has provided specific instructions. Follow this direction closely: "${customInstructions}"` : '',
          negativePrompt: negativePrompt.trim() ? `**AVOID**: Do NOT include the following elements, themes, or styles: "${negativePrompt}"` : '',
          style: `**Overall Style**: The final image must look professionally designed. Use vibrant colors, dramatic lighting, and a clear focal point to maximize click-through rate. The composition should feel unified and intentional.`,
      };

      const coreInstructions = [
          instructions.subjectIntegration,
          instructions.fullBleedBackground,
          instructions.contextualImages,
          instructions.mainText,
          instructions.subtitleText,
          instructions.textStyling,
          instructions.creativeDirection,
          instructions.negativePrompt,
          instructions.style
      ].filter(Boolean).map((inst, index) => `${index + 1}. ${inst}`).join('\n');

      switch (aspectRatio) {
          case '16:9':
          case '9:16':
              return `${basePrompt}\n**Core Task**: Create a dynamic thumbnail with a ${aspectRatio} aspect ratio.\n\n**CRITICAL INSTRUCTIONS:**\n${coreInstructions}`;
          
          case 'both':
              return `${basePrompt}
**Core Task**: Create a single 16:9 landscape image that is perfectly designed to be croppable for both 16:9 (standard) and 9:16 (Shorts) formats.

**CRITICAL INSTRUCTIONS:**
1. **Full 16:9 Composition**: First, create a complete, full-bleed 16:9 landscape scene.
2. **Central Safe Zone**: Place ALL essential elements (the main subject, the main text, the subtitle, and any critical graphics) within the central 9:16 vertical portion of that 16:9 image. This ensures that when cropped to 9:16 for Shorts, no important information is lost.
3. **Unified Design**: The elements outside the safe zone must still be part of the cohesive background, not just filler. They should make the 16:9 version look complete and professional.
${coreInstructions.replace('1. ', '4. ')}`;
          
          default:
              return '';
      }
  }

  const addResultToHistory = (newThumbnail: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newThumbnail);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleGenerate = useCallback(async () => {
    if (!videoTitle.trim()) {
      setError('Please enter a video title.');
      return;
    }
    if (!mainHeadshot) {
      setError('Please upload a main headshot.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const mainImageBase64 = await fileToBase64(mainHeadshot.file);
      const contextualImagesBase64 = await Promise.all(
        contextualImages.map(img => fileToBase64(img.file).then(data => ({ data, mimeType: img.file.type })))
      );

      const allImages = [
        { data: mainImageBase64, mimeType: mainHeadshot.file.type },
        ...contextualImagesBase64,
      ];

      const prompt = getPrompt();
      if (!prompt) {
        setError('Invalid aspect ratio selected.');
        setIsLoading(false);
        return;
      }

      const generatedImage = await generateThumbnail(prompt, allImages);
      addResultToHistory(`data:image/png;base64,${generatedImage}`);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [videoTitle, subtitle, customInstructions, negativePrompt, textLanguage, textStylingInstructions, aspectRatio, mainHeadshot, contextualImages, history, historyIndex]);

  const handleUpdateText = useCallback(async () => {
    if (!currentThumbnail) {
        setError('Generate an image first before updating text.');
        return;
    }
    if (!videoTitle.trim()) {
        setError('A video title is required to update text.');
        return;
    }

    setError(null);
    setIsUpdatingText(true);

    try {
        const base64Data = currentThumbnail.split(',')[1];
        const mimeType = currentThumbnail.match(/:(.*?);/)?.[1] || 'image/png';
        const imageForEditing = [{ data: base64Data, mimeType }];

        const textUpdatePrompt = `You are a text editing expert for YouTube thumbnails. Your ONLY task is to modify the text on the provided image.
1. **Analyze and Remove**: First, identify and completely remove any existing text from the image, seamlessly healing the background behind it.
2. **Add New Text**: Then, add the following text elements:
   - **Main Title**: "${videoTitle}"
   - **Subtitle**: ${subtitle.trim() ? `"${subtitle.trim()}"` : 'Do not add a subtitle.'}
3. **Apply Styles**:
   - The text language is: "${textLanguage}".
   - Render the text EXACTLY as written. Do not translate or alter it.
   - Apply these specific styling instructions to the text: "${textStylingInstructions || 'Use a font and color scheme that is bold, modern, and has high contrast with the background.'}"
4. **Preserve Image**: DO NOT change the background, the main subject, or any other visual elements of the original image. Your sole focus is replacing the text cleanly and professionally.`;
        
        const generatedImage = await generateThumbnail(textUpdatePrompt, imageForEditing);
        addResultToHistory(`data:image/png;base64,${generatedImage}`);

    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while updating text.');
    } finally {
        setIsUpdatingText(false);
    }
  }, [videoTitle, subtitle, textLanguage, textStylingInstructions, currentThumbnail, history, historyIndex]);


  const AspectRatioButton: React.FC<{value: '16:9' | '9:16' | 'both', label: string}> = ({value, label}) => (
      <button 
        onClick={() => setAspectRatio(value)}
        className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${aspectRatio === value ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
      >
        {value} <span className="text-gray-400">({label})</span>
      </button>
  );

  const ImageUploadArea: React.FC<{onFileChange: (e: ChangeEvent<HTMLInputElement>) => void, multiple?: boolean, title: string, description: string}> = 
  ({onFileChange, multiple = false, title, description}) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">{title}</label>
        <input type="file" onChange={onFileChange} multiple={multiple} accept="image/png, image/jpeg" className="hidden" id={title}/>
        <label htmlFor={title} className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className="w-8 h-8 mb-2 text-gray-500" />
                <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span></p>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
        </label>
    </div>
  );

  const ImagePreview: React.FC<{image: Headshot, onRemove: (id: string) => void}> = ({image, onRemove}) => (
    <div className="relative group">
        <img src={image.previewUrl} alt="Preview" className="w-full aspect-square object-cover rounded-lg"/>
        <button 
            onClick={() => onRemove(image.id)}
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove image"
        >
            X
        </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column: Inputs */}
          <div className="flex flex-col gap-6">
            <div>
              <label htmlFor="video-title" className="block text-sm font-medium text-gray-300 mb-2">
                1. Main Text (Required)
              </label>
              <input type="text" id="video-title" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="e.g., My Craziest Skydive Ever!"
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>

            <div>
              <label htmlFor="subtitle" className="block text-sm font-medium text-gray-300 mb-2">
                2. Subtitle (Optional)
              </label>
              <input type="text" id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Text to appear smaller on the thumbnail"
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>

            {currentThumbnail && (
                <div className="p-4 border-2 border-dashed border-purple-800 rounded-lg bg-gray-800/50 space-y-4 transition-all duration-500 ease-in-out">
                    <h3 className="text-lg font-semibold text-purple-300 text-center">Fine-Tune Text</h3>
                    <div>
                        <label htmlFor="text-styling" className="block text-sm font-medium text-gray-300 mb-2">
                           Text Style Instructions
                        </label>
                        <textarea id="text-styling" value={textStylingInstructions} onChange={(e) => setTextStylingInstructions(e.target.value)} placeholder="e.g., Bright yellow text with a thick black outline, graffiti style font."
                            rows={2} className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
                    </div>
                     <button onClick={handleUpdateText} disabled={isLoading || isUpdatingText}
                        className="w-full flex items-center justify-center gap-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out">
                         {isUpdatingText ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Updating Text...
                            </>
                         ) : 'Update Text Only'}
                     </button>
                </div>
            )}

            <div>
              <label htmlFor="custom-instructions" className="block text-sm font-medium text-gray-300 mb-2">
                3. Creative Instructions (Optional)
              </label>
              <textarea id="custom-instructions" value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="e.g., Make the background a fiery explosion, I should look scared, use a cinematic style."
                rows={3} className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>

             <div>
              <label htmlFor="negative-prompt" className="block text-sm font-medium text-gray-300 mb-2">
                4. Negative Prompt (Optional)
              </label>
              <input type="text" id="negative-prompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="e.g., no text, cartoonish, blurry background"
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>
            
            <div>
              <label htmlFor="text-language" className="block text-sm font-medium text-gray-300 mb-2">
                5. Language for Text on Thumbnail
              </label>
              <input type="text" id="text-language" value={textLanguage} onChange={(e) => setTextLanguage(e.target.value)} placeholder="e.g., English, Hindi, Spanish"
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>

             <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">6. Aspect Ratio</label>
              <div className="flex items-center gap-2">
                <AspectRatioButton value="16:9" label="Standard" />
                <AspectRatioButton value="9:16" label="Shorts" />
                <AspectRatioButton value="both" label="Versatile" />
              </div>
            </div>

            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300">7. Upload Images</label>
                {!mainHeadshot ? (
                    <ImageUploadArea onFileChange={(e) => handleFileChange(e, true)} title="Main Headshot (Required)" description="PNG or JPG"/>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Main Headshot</label>
                        <div className="w-24">
                           <ImagePreview image={mainHeadshot} onRemove={(id) => removeImage(id, true)} />
                        </div>
                    </div>
                )}
                
                <ImageUploadArea onFileChange={(e) => handleFileChange(e, false)} multiple title="Contextual Images (Optional)" description="Add images for background/elements"/>
                {contextualImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {contextualImages.map(img => <ImagePreview key={img.id} image={img} onRemove={(id) => removeImage(id, false)} />)}
                    </div>
                )}
            </div>
            
            <button
              onClick={handleGenerate} disabled={isLoading || isUpdatingText || !mainHeadshot}
              className="w-full flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out">
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-6 h-6" />
                  {currentThumbnail ? 'Regenerate Everything' : 'Generate Thumbnail'}
                </>
              )}
            </button>
             {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg mt-4 text-center">
                <p>{error}</p>
              </div>
            )}
          </div>
          
          {/* Right Column: Output */}
          <div className="flex flex-col">
             <label className="block text-sm font-medium text-gray-300 mb-2">
                Your AI-Generated Thumbnail
              </label>
            <ThumbnailDisplay 
              thumbnail={currentThumbnail} 
              isLoading={isLoading || isUpdatingText} 
              videoTitle={videoTitle}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
