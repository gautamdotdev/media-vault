import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Play, Pause,
  Volume2, VolumeX, Maximize2,
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { MediaItem } from './types';

interface MediaPreviewProps {
  item: MediaItem;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  currentIndex: number;
  totalCount: number;
}


/** Shared Cloudinary HEIC→JPEG URL rewriter (mirrors VaultInteriorView) */
function toDisplayUrl(url: string, fileName: string): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') || url.startsWith('blob:') ? url : `${apiBase}${url}`;
  const isHeic = /\.(heic|heif)$/i.test(fileName);
  const isCloudinary = fullUrl.includes('res.cloudinary.com');
  if (isHeic && isCloudinary) {
    return fullUrl.replace(/\/upload\//, '/upload/f_jpg,q_auto/');
  }
  return fullUrl;
}

function VaultImagePreview({ media }: { media: MediaItem }) {
  const [error, setError] = useState(false);

  if (!media.url) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/40">
        <p className="text-sm">No image URL</p>
      </div>
    );
  }

  const displayUrl = toDisplayUrl(media.url, media.name);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/40">
        <p className="text-sm">Unable to load image</p>
        <p className="text-xs font-mono">{media.name}</p>
      </div>
    );
  }

  return (
    <TransformWrapper
      key={media.id}
      initialScale={1}
      minScale={1}
      maxScale={5}
      centerOnInit
      wheel={{ step: 0.1 }}
      pinch={{ step: 1 }}
      doubleClick={{ mode: 'toggle' }}
    >
      <TransformComponent
        wrapperClass="!w-full !h-full"
        contentClass="!w-full !h-full flex items-center justify-center"
      >
        <img
          src={displayUrl}
          alt={media.name}
          className="max-h-full max-w-full object-contain"
          draggable={false}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.dataset.fallback && displayUrl.includes('cloudinary')) {
              target.dataset.fallback = '1';
              target.src = displayUrl.replace(/\/upload\/[^/]+\//, '/upload/f_auto,q_auto/');
            } else {
              setError(true);
            }
          }}
        />
      </TransformComponent>
    </TransformWrapper>
  );
}



function VaultVideoPreview({ media }: { media: MediaItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const p = x / rect.width;
      videoRef.current.currentTime = p * videoRef.current.duration;
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const onPlay = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
      };
    }
  }, []);

  const isAbsolute = (media.url || "").startsWith('http') || (media.url || "").startsWith('blob:');
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const fullUrl = isAbsolute ? (media.url || "") : `${apiBase}${media.url || ""}`;

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center group"
      onMouseMove={handleMouseMove}
      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
    >
      <video
        ref={videoRef}
        src={fullUrl}
        className="max-h-full max-w-full pointer-events-none"
        onTimeUpdate={handleTimeUpdate}
        playsInline
        autoPlay
        muted={isMuted}
      />

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-4 z-[80]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress Bar */}
            <div 
              className="h-1.5 w-full bg-white/20 rounded-full cursor-pointer relative group/progress"
              onClick={handleProgressClick}
            >
              <div 
                className="absolute inset-y-0 left-0 bg-vault-accent rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{ left: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-vault-accent transition-colors">
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                </button>
                <div className="flex items-center gap-2 group/volume">
                  <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-vault-accent transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    value={isMuted ? 0 : volume} 
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (videoRef.current) videoRef.current.volume = v;
                      if (v > 0) setIsMuted(false);
                    }}
                    className="w-0 group-hover/volume:w-20 transition-all duration-300 accent-vault-accent h-1"
                  />
                </div>
                <span className="text-[10px] font-mono text-white/60">
                  {videoRef.current ? 
                    `${Math.floor(videoRef.current.currentTime / 60)}:${Math.floor(videoRef.current.currentTime % 60).toString().padStart(2, '0')} / ${Math.floor(videoRef.current.duration / 60)}:${Math.floor(videoRef.current.duration % 60).toString().padStart(2, '0')}` 
                    : '0:00 / 0:00'
                  }
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => videoRef.current?.requestFullscreen()} 
                  className="text-white hover:text-vault-accent transition-colors"
                >
                  <Maximize2 size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isPlaying && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 animate-pulse">
            <Play size={40} fill="white" className="text-white ml-2" />
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaPreview({ item, onClose, onNext, onPrev, hasNext, hasPrev, currentIndex, totalCount }: MediaPreviewProps) {
  const isImage = item.type === 'image' || /\.(heic|heif|jpg|jpeg|png|gif|webp)$/i.test(item.name);
  const isVideo = item.type === 'video' || /\.(mp4|mov|webm|avi)$/i.test(item.name);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-[100] bg-[#050505]/95 backdrop-blur-2xl flex items-center justify-center overflow-hidden"
    >
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 h-20 px-6 flex items-center justify-between z-[110] bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-white/90 truncate max-w-[200px] sm:max-w-md">{item.name}</h3>
          <p className="text-[10px] text-white/40 font-mono tracking-wider uppercase">
            {currentIndex + 1} of {totalCount} • {item.size}
          </p>
        </div>
        
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-center z-[110] pointer-events-none">
        {hasPrev && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all pointer-events-auto"
          >
            <ChevronLeft size={24} />
          </button>
        )}
      </div>

      <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center z-[110] pointer-events-none">
        {hasNext && (
          <button 
            onClick={(e) => { e.stopPropagation(); onNext?.(); }}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all pointer-events-auto"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="w-full h-full flex items-center justify-center">
        {isImage ? (
          <VaultImagePreview media={item} />
        ) : isVideo ? (
          <VaultVideoPreview media={item} />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/40">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Play size={40} />
            </div>
            <p className="text-sm font-medium tracking-widest uppercase">Format not supported for preview</p>
            <p className="text-xs">{item.name}</p>
          </div>
        )}
      </div>

      {/* Bottom Thumbnails Strip (Optional Enhancement) */}
      {/* ... could add a small horizontal list of thumbs here for premium feel ... */}
    </motion.div>
  );
}
