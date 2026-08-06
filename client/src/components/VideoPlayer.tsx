import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface VideoPlayerProps {
    src: string,
    fileName: string
}

export function VideoPlayer({src,fileName} : VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);


    return (
        <div className="relative max-w-md rounded-lg overflow-hidden bg-black group">
        <video
            ref={videoRef}
            src={src}
            className="w-full max-h-96"
            controls
        />
        {fileName && (
            <div className="px-3 py-1 text-xs text-white/70 bg-black/40 truncate">
            {fileName}
            </div>
        )}
        </div>
    );
        
}