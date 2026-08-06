import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface VideoPlayerProps {
    src: string,
    fileName: string
}

export function VideoPlayer({src,fileName} : VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted,setIsMuted] = useState(false);

    const togglePlay = () => {
        const video = videoRef.current;

        if(!video) return;
        if(video.paused) {
            video.play();
            setIsPlaying(true);
        }   
        else {
            video.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if(!video) return;

        if(video.muted) {
            video.muted = false;
            setIsMuted(false);
        }
        else {

        }
    }

    const toggleFullscreen = () => {
        videoRef.current?.requestFullscreen();
    };
    
    return (
        <div className="relative max-w-md rounded-lg overflow-hidden bg-black group">
        <video
            ref={videoRef}
            src={src}
            className="w-full max-h-96"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
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