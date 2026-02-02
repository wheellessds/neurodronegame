export const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    });
};

export const preloadAudio = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.src = src;
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error(`Failed to load audio: ${src}`));
    });
};

export interface PreloadProgress {
    total: number;
    loaded: number;
    percent: number;
}

export const preloadAssets = async (
    images: string[],
    onProgress?: (progress: PreloadProgress) => void
): Promise<void> => {
    const total = images.length;
    let loaded = 0;

    const updateProgress = () => {
        loaded++;
        if (onProgress) {
            onProgress({
                total,
                loaded,
                percent: Math.round((loaded / total) * 100),
            });
        }
    };

    const promises = images.map(async (src) => {
        try {
            await preloadImage(src);
        } catch (e) {
            console.warn(e);
        } finally {
            updateProgress();
        }
    });

    await Promise.all(promises);
};
