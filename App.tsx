import React, { useState, useCallback, ChangeEvent } from 'react';
import { Header } from './components/Header';
import { ThumbnailDisplay } from './components/ThumbnailDisplay';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { UploadIcon } from './components/icons/UploadIcon';
import { Headshot } from './types';
import { generateThumbnail } from './services/geminiService';

const App: React.FC = () => {
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [shortDescription, setShortDescription] = useState<string>('');
  const [textLanguage, setTextLanguage] = useState<string>('English');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | 'both'>('16:9');
  const [mainHeadshot, setMainHeadshot] = useState<Headshot | null>(null);
  const [contextualImages, setContextualImages] = useState<Headshot[]>([]);
  const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
    const basePrompt = `You are an expert YouTube thumbnail designer.
Video Title: "${videoTitle}"
Video Description: "${shortDescription}"
Text Language for Thumbnail: "${textLanguage}"
The user has provided a primary headshot (the first image) and several optional contextual images.`;

    const instructions = {
        subjectIntegration: `**Subject Integration**: Extract the person from the main headshot. Do not keep the original crop. Seamlessly integrate them into a NEWLY generated, full-width background. You can reposition, resize, or slightly angle the person to fit the new dynamic scene.`,
        fullBleedBackground: `**Full-Bleed Background**: The background must be a complete, visually rich scene that extends to every edge of the frame. It should be directly inspired by the video title. For example, if the title is "Exploring Ancient Ruins," the background should be a wide shot of dramatic ruins, not just a texture.`,
        contextualImages: `**Contextual Images**: If other images are provided, use them as smaller elements, inspiration for background details, or layered effects within the new scene.`,
        eyeCatchingText: `**Eye-Catching Text**: Add the video title ("${videoTitle}") as large, high-contrast, and easily readable text. The text must be in ${textLanguage}. Place the text strategically to draw attention.`,
        style: `**Overall Style**: The final image must look like a professionally designed thumbnail. Use vibrant colors, dramatic lighting, and a clear focal point to maximize click-through rate. The composition should feel unified and intentional, not like a cut-and-paste job. Avoid empty or plain-colored bars on the sides at all costs.`
    };

    switch (aspectRatio) {
        case '16:9':
            return `${basePrompt}
**Core Task**: Take the user's main headshot and COMPLETELY REIMAGINE it into a dynamic 16:9 landscape scene. Do NOT just place the edited portrait image on a background with filler on the sides. You must create a new, cohesive composition that fills the entire 16:9 frame.

**CRITICAL INSTRUCTIONS for 16:9 Generation:**
1. ${instructions.subjectIntegration}
2. ${instructions.fullBleedBackground}
3. ${instructions.contextualImages}
4. ${instructions.eyeCatchingText}
5. ${instructions.style}`;

        case '9:16':
            return `${basePrompt}
**Core Task**: Create a viral, full-bleed 9:16 portrait thumbnail.

**CRITICAL INSTRUCTIONS for 9:16 Generation:**
1. ${instructions.subjectIntegration}
2. ${instructions.fullBleedBackground}
3. ${instructions.contextualImages}
4. ${instructions.eyeCatchingText}
5. ${instructions.style}`;

        case 'both':
            return `${basePrompt}
**Core Task**: Create a single 16:9 landscape image that is perfectly designed to be croppable for both 16:9 (standard) and 9:16 (Shorts) formats.

**CRITICAL INSTRUCTIONS for Versatile (Both) Generation:**
1. **Full 16:9 Composition**: First, create a complete, full-bleed 16:9 landscape scene. The background must fill the entire frame.
2. **Central Safe Zone**: Place ALL essential elements (the main subject, the main text, and any critical graphics) within the central 9:16 vertical portion of that 16:9 image. This ensures that when cropped to 9:16 for Shorts, no important information is lost.
3. **Unified Design**: The elements outside the safe zone should still be part of the cohesive background, not just filler. They should make the 16:9 version look complete and professional.
4. ${instructions.subjectIntegration} Place the subject within the central safe zone.
5. ${instructions.contextualImages} Place critical elements within the safe zone.
6. ${instructions.eyeCatchingText} Place text within the safe zone.
7. ${instructions.style}`;
        
        default:
            return '';
    }
  }


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
    setGeneratedThumbnail(null);

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
      setGeneratedThumbnail(`data:image/png;base64,${generatedImage}`);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [videoTitle, shortDescription, textLanguage, aspectRatio, mainHeadshot, contextualImages]);

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
                1. Video Title (Required)
              </label>
              <input type="text" id="video-title" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="e.g., My Craziest Skydive Ever!"
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>

            <div>
              <label htmlFor="video-desc" className="block text-sm font-medium text-gray-300 mb-2">
                2. Short Description (Optional)
              </label>
              <textarea id="video-desc" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="e.g., A vlog about my first time jumping out of a plane and conquering my fears."
                rows={3} className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>
            
            <div>
              <label htmlFor="text-language" className="block text-sm font-medium text-gray-300 mb-2">
                3. Language for Text on Thumbnail
              </label>
              <input type="text" id="text-language" value={textLanguage} onChange={(e) => setTextLanguage(e.target.value)} placeholder="e.g., English, Hindi, Spanish"
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"/>
            </div>

             <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">4. Aspect Ratio</label>
              <div className="flex items-center gap-2">
                <AspectRatioButton value="16:9" label="Standard" />
                <AspectRatioButton value="9:16" label="Shorts" />
                <AspectRatioButton value="both" label="Versatile" />
              </div>
            </div>

            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300">5. Upload Images</label>
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
              onClick={handleGenerate} disabled={isLoading || !mainHeadshot}
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
                  Generate Thumbnail
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
                6. Your AI-Generated Thumbnail
              </label>
            <ThumbnailDisplay thumbnail={generatedThumbnail} isLoading={isLoading} videoTitle={videoTitle} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;