import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Upload, Star, Play, X, Grid3X3, List,
  CheckSquare, Square, FileImage, FileVideo, Check, MoreHorizontal,
  Copy, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { MediaPreview } from './MediaPreview';
import type { Vault, FilterOption, SortOption, ViewMode, MediaItem } from './types';
import heic2any from 'heic2any';

/* ============ Smooth Confirm Dialog (framer-motion) ============ */
function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive = true, onConfirm,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; description: string;
  confirmLabel?: string; destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 bg-vault-surface border border-vault-border shadow-2xl p-5"
          >
            <p className="text-sm font-medium text-vault-text mb-1">{title}</p>
            <p className="text-xs text-vault-muted mb-5">{description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 py-2.5 border border-vault-border text-vault-text text-xs hover:bg-vault-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onConfirm(); onOpenChange(false); }}
                className={`flex-1 py-2.5 text-xs font-medium transition-opacity hover:opacity-90 ${
                  destructive ? 'bg-vault-danger text-white' : 'bg-vault-accent text-vault-bg'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Rewrites a Cloudinary HEIC/HEIF URL to serve as JPEG via Cloudinary's
 * server-side transformation (f_jpg,q_auto). This is far more reliable than
 * client-side libheif conversion which fails on many HEIC encodings.
 *
 * Input:  https://res.cloudinary.com/<cloud>/image/upload/v123/folder/file.heic
 * Output: https://res.cloudinary.com/<cloud>/image/upload/f_jpg,q_auto/v123/folder/file.heic
 */
function toDisplayUrl(url: string, fileName: string): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') || url.startsWith('blob:') ? url : `${apiBase}${url}`;

  const isHeic = /\.(heic|heif)$/i.test(fileName);
  const isCloudinary = fullUrl.includes('res.cloudinary.com');

  if (isHeic && isCloudinary) {
    // Insert f_jpg,q_auto transformation after /upload/
    return fullUrl.replace(
      /\/upload\//,
      '/upload/f_jpg,q_auto/'
    );
  }

  return fullUrl;
}

function VaultImage({ media, className, onClick }: { media: MediaItem; className?: string; onClick?: (e: any) => void }) {
  const displayUrl = media.url ? toDisplayUrl(media.url, media.name) : null;

  if (!displayUrl) {
    return <div className={`bg-vault-elevated animate-pulse ${className}`} />;
  }

  return (
    <img
      src={displayUrl}
      alt={media.name}
      className={className}
      loading="lazy"
      onClick={onClick}
      onError={(e) => {
        // Last-resort fallback: try stripping any transformation and requesting auto format
        const target = e.target as HTMLImageElement;
        if (!target.dataset.fallback && displayUrl.includes('cloudinary')) {
          target.dataset.fallback = '1';
          target.src = displayUrl.replace(/\/upload\/[^/]+\//, '/upload/f_auto,q_auto/');
        }
      }}
    />
  );
}


/** Extracts a thumbnail from the first seekable frame of a video URL */
function VaultVideoThumb({ media, className, onClick }: { media: MediaItem; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!media.url) { setFailed(true); return; }
    const isAbsolute = media.url.startsWith('http') || media.url.startsWith('blob:');
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const fullUrl = isAbsolute ? media.url : `${apiBase}${media.url}`;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.src = '';
      video.load();
    };

    video.addEventListener('loadedmetadata', () => {
      // Seek to 1s or 10% into the video, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setFailed(true); cleanup(); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumbUrl(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        setFailed(true);
      }
      cleanup();
    });

    video.addEventListener('error', () => { setFailed(true); cleanup(); });

    video.src = fullUrl;

    return () => {
      cleanup();
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [media.url]);

  if (failed || !thumbUrl) {
    return (
      <div className={`flex items-center justify-center bg-vault-elevated ${className}`} onClick={onClick}>
        <Play size={20} className="text-vault-muted" />
      </div>
    );
  }

  return (
    <img
      src={thumbUrl}
      alt={media.name}
      className={className}
      onClick={onClick}
    />
  );
}


interface Props {
  vaultId: string;
  vault: Vault;
  onLock: () => void;
  onRefresh: () => Promise<void>;
  onUpdateVault: (v: Vault) => Promise<void> | void;
  onDeleteVault: () => Promise<void> | void;
  onClearAllMedia: () => Promise<void> | void;
  onRemoveMedia: (ids: string[]) => Promise<void> | void;
  onToggleStar: (mediaId: string) => Promise<void> | void;
  onUploadMedia: (files: File[], onProgress?: (fileIndex: number, percent: number, bytesLoaded: number, bytesTotal: number) => void) => Promise<void> | void;
  onRevokeAccess: () => void;
  theme: string;
  setTheme: (t: string) => void;
}

export function VaultInteriorView({
  vaultId,
  vault,
  onLock,
  onRefresh,
  onUpdateVault,
  onDeleteVault,
  onClearAllMedia,
  onRemoveMedia,
  onToggleStar,
  onUploadMedia,
  onRevokeAccess,
  theme,
  setTheme,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await onRefresh(); } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, [onRefresh]);

  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [uploadView, setUploadView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsView, setSettingsView] = useState(false);
  const [shareView, setShareView] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const { mediaId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isImage = (m: MediaItem) => m.type === 'image' || /\.(heic|heif|jpg|jpeg|png|gif|webp)$/i.test(m.name);
  const isVideo = (m: MediaItem) => m.type === 'video' || /\.(mp4|mov|webm|avi)$/i.test(m.name);


  const filteredMedia = useMemo(() => {
    let items = [...vault.media];

    if (searchQuery) items = items.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    switch (filter) {
      case 'images': items = items.filter(isImage); break;
      case 'videos': items = items.filter(isVideo); break;
      case 'starred': items = items.filter(m => m.starred); break;
      case 'recent': items = items.slice(0, 6); break;
    }

    switch (sort) {
      case 'newest': items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case 'oldest': items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
      case 'name': items.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'size': items.sort((a, b) => parseFloat(b.size) - parseFloat(a.size)); break;
    }
    return items;
  }, [vault.media, filter, sort, searchQuery]);

  // Sync preview index with mediaId in URL
  useEffect(() => {
    if (mediaId) {
      const idx = filteredMedia.findIndex(m => m.id === mediaId);
      if (idx !== -1) {
        setPreviewIndex(idx);
      } else {
        // If not found in filtered list, try finding in all media
        const allIdx = vault.media.findIndex(m => m.id === mediaId);
        if (allIdx !== -1) {
          // Reset filters to show the item
          setFilter('all');
          setSearchQuery('');
          setPreviewIndex(allIdx);
        }
      }
    } else {
      setPreviewIndex(null);
    }
  }, [mediaId, filteredMedia, vault.media]);

  const updatePreviewUrl = (idx: number | null) => {
    if (idx !== null && filteredMedia[idx]) {
      navigate(`/vault/${vaultId}/m/${filteredMedia[idx].id}`);
    } else {
      navigate(`/vault/${vaultId}`);
    }
  };

  const toggleStar = useCallback(async (id: string) => {
    await onToggleStar(id);
  }, [onToggleStar]);

  const deleteMedia = useCallback(async (ids: string[]) => {
    await onRemoveMedia(ids);
    setSelected(new Set());
    setSelectMode(false);
    showToast('success', `${ids.length} item(s) removed`);
  }, [onRemoveMedia, showToast]);

  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingGlobal(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDroppedFiles(Array.from(e.dataTransfer.files));
      setUploadView(true);
    }
  }, []);

  const counts = useMemo(() => ({
    all: vault.media.length,
    images: vault.media.filter(m => m.type === 'image').length,
    videos: vault.media.filter(m => m.type === 'video').length,
    starred: vault.media.filter(m => m.starred).length,
  }), [vault.media]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (previewIndex === null) return;
      if (e.key === 'Escape') updatePreviewUrl(null);
      if (e.key === 'ArrowRight' && previewIndex < filteredMedia.length - 1) updatePreviewUrl(previewIndex + 1);
      if (e.key === 'ArrowLeft' && previewIndex > 0) updatePreviewUrl(previewIndex - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewIndex, filteredMedia.length, navigate, vaultId]);

  if (uploadView) {
    return <UploadView 
      initialFiles={droppedFiles}
      onClose={() => { setUploadView(false); setDroppedFiles([]); }} 
      onUpload={async (files, onProgress) => {
        await onUploadMedia(files, onProgress);
        showToast('success', `${files.length} file(s) uploaded`);
      }} 
    />;
  }

  if (settingsView) {
    return <VaultSettingsView
      vault={vault}
      onUpdate={onUpdateVault}
      onClose={() => setSettingsView(false)}
      onDeleteAll={onClearAllMedia}
      onDestroyVault={onDeleteVault}
      onRevokeAccess={onRevokeAccess}
    />;
  }

  if (shareView) {
    return <ShareView vaultId={vaultId} vault={vault} onClose={() => setShareView(false)} />;
  }

  if (previewIndex !== null && filteredMedia[previewIndex]) {
    return (
      <MediaPreview
        item={filteredMedia[previewIndex]}
        onClose={() => updatePreviewUrl(null)}
        onNext={() => updatePreviewUrl(previewIndex + 1)}
        onPrev={() => updatePreviewUrl(previewIndex - 1)}
        hasNext={previewIndex < filteredMedia.length - 1}
        hasPrev={previewIndex > 0}
        currentIndex={previewIndex}
        totalCount={filteredMedia.length}
      />
    );
  }

  const filterTabs: { key: FilterOption; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'images', label: 'Photos', count: counts.images },
    { key: 'videos', label: 'Videos', count: counts.videos },
    { key: 'starred', label: 'Starred', count: counts.starred },
  ];

  return (
    <div 
      className="flex flex-col h-screen bg-vault-bg relative"
      onDragOver={e => { e.preventDefault(); setIsDraggingGlobal(true); }}
      onDragLeave={e => {
        if (e.currentTarget === e.target) setIsDraggingGlobal(false);
      }}
      onDrop={handleGlobalDrop}
    >
      <AnimatePresence>
        {isDraggingGlobal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-vault-accent/10 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="p-8 border-2 border-dashed border-vault-accent bg-vault-bg/90 flex flex-col items-center gap-4">
              <Upload size={48} className="text-vault-accent animate-bounce" />
              <p className="text-xl font-bold text-vault-text">Drop files to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-shrink-0 border-b border-vault-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onLock} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-vault-text truncate">{vault.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen(!searchOpen)} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
              <Search size={18} />
            </button>
            <button onClick={() => setUploadView(true)} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
              <Upload size={18} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Sync media"
              className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors disabled:opacity-40"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-vault-surface border border-vault-border shadow-lg">
                    <button onClick={() => { setShareView(true); setMenuOpen(false); }} className="w-full px-3 py-2.5 text-left text-sm text-vault-text hover:bg-vault-elevated transition-colors">Share access</button>
                    <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMenuOpen(false); }} className="w-full px-3 py-2.5 text-left text-sm text-vault-text hover:bg-vault-elevated transition-colors">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
                    <div className="border-t border-vault-border" />
                    <button onClick={() => { setSettingsView(true); setMenuOpen(false); }} className="w-full px-3 py-2.5 text-left text-sm text-vault-muted hover:bg-vault-elevated transition-colors">Vault settings</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {searchOpen && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-9 py-2.5 bg-vault-elevated border border-vault-border text-vault-text text-sm placeholder:text-vault-muted/60 focus:border-vault-muted focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 pb-2.5">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === tab.key
                    ? 'bg-vault-accent text-vault-bg'
                    : 'text-vault-muted hover:text-vault-text'
                }`}
              >
                {tab.label} {tab.count > 0 && tab.count}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button onClick={() => setViewMode('grid')} className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'text-vault-text' : 'text-vault-muted hover:text-vault-text'}`}>
              <Grid3X3 size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'text-vault-text' : 'text-vault-muted hover:text-vault-text'}`}>
              <List size={16} />
            </button>
            <button 
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} 
              className={`w-8 h-8 flex items-center justify-center transition-colors ${selectMode ? 'text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}
              title={selectMode ? 'Exit selection' : 'Select items'}
            >
              {selectMode ? <X size={16} /> : <CheckSquare size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <p className="text-sm text-vault-muted mb-4">No media</p>
            <button onClick={() => setUploadView(true)} className="px-4 py-2.5 bg-vault-accent text-vault-bg text-sm font-medium hover:opacity-90 transition-opacity">
              Upload
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="px-2 py-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-0.5">
            {filteredMedia.map((item, idx) => (
              <div
                key={item.id}
                className={`group relative cursor-pointer overflow-hidden ${selected.has(item.id) ? 'ring-2 ring-vault-accent ring-inset' : ''}`}
                onClick={() => selectMode ? setSelected(prev => {
                  const next = new Set(prev);
                  if (next.has(item.id)) {
                    next.delete(item.id);
                  } else {
                    next.add(item.id);
                  }
                  return next;
                }) : updatePreviewUrl(idx)}
              >
                <div className="aspect-square relative bg-vault-elevated">
                  {isImage(item) && item.url ? (
                    <VaultImage media={item} className="w-full h-full object-cover" />
                  ) : isVideo(item) && item.url ? (
                    <>
                      <VaultVideoThumb media={item} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                          <Play size={14} className="text-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play size={20} className="text-vault-muted" />
                    </div>
                  )}

                  {item.type === 'video' && item.duration && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-mono">{item.duration}</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); toggleStar(item.id); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Star size={14} className={item.starred ? 'fill-white text-white' : 'text-white/60'} />
                  </button>
                  {selectMode && (
                    <div className="absolute top-1.5 left-1.5">
                      {selected.has(item.id) ? <CheckSquare size={16} className="text-vault-accent" /> : <Square size={16} className="text-white/60" />}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {filteredMedia.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-vault-border/40 cursor-pointer hover:bg-vault-elevated transition-colors"
                onClick={() => updatePreviewUrl(idx)}
              >
                <div className="w-10 h-10 overflow-hidden bg-vault-elevated flex-shrink-0 relative">
                  {isImage(item) && item.url ? (
                    <VaultImage media={item} className="w-full h-full object-cover" />
                  ) : isVideo(item) && item.url ? (
                    <>
                      <VaultVideoThumb media={item} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play size={10} className="text-white ml-0.5" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Play size={14} className="text-vault-muted" /></div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-vault-text truncate">{item.name}</p>
                  <p className="text-xs text-vault-muted">{item.size} · {item.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectMode && selected.size > 0 && (
          <motion.div
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-vault-surface border-t border-vault-border px-4 py-3 flex items-center justify-between safe-bottom"
          >
            <span className="text-xs text-vault-muted">{selected.size} selected</span>
            <div className="flex gap-2">
              <button onClick={() => { selected.forEach(id => { void toggleStar(id); }); setSelected(new Set()); }} className="px-3 py-1.5 border border-vault-border text-vault-text text-xs hover:bg-vault-elevated transition-colors">
                Star
              </button>
              <button onClick={() => setConfirmBulkDelete(true)} className="px-3 py-1.5 border border-vault-danger/30 text-vault-danger text-xs hover:bg-vault-danger/10 transition-colors">
                Remove
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={`Remove ${selected.size} item(s)?`}
        description="This action cannot be undone. The selected media will be permanently removed from this vault."
        confirmLabel="Remove"
        onConfirm={() => { void deleteMedia([...selected]); setConfirmBulkDelete(false); }}
      />
    </div>
  );
}

/* ============ Upload ============ */

type FileUploadState = 'idle' | 'uploading' | 'done' | 'error';

interface FileProgress {
  percent: number;
  bytesLoaded: number;
  bytesTotal: number;
  speed: number; // bytes per second
  state: FileUploadState;
  startTime: number;
  errorMsg?: string;
}

function VideoThumbPreview({ file }: { file: File }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(1, video.duration * 0.1); });
    video.addEventListener('seeked', () => {
      try {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        ctx?.drawImage(video, 0, 0, 64, 64);
        setThumbUrl(c.toDataURL('image/jpeg', 0.7));
      } catch { /* ignore */ }
      URL.revokeObjectURL(url);
    });
    video.addEventListener('error', () => URL.revokeObjectURL(url));
    video.src = url;
    return () => URL.revokeObjectURL(url);
  }, []);
  if (!thumbUrl) return <FileVideo size={14} className="text-vault-muted" />;
  return <img src={thumbUrl} alt="" className="w-full h-full object-cover" />;
}

function ImageThumbPreview({ file }: { file: File }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, []);
  if (!thumbUrl) return <FileImage size={14} className="text-vault-muted" />;
  return <img src={thumbUrl} alt="" className="w-full h-full object-cover" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

function UploadView({ onClose, onUpload, initialFiles = [] }: {
  onClose: () => void;
  onUpload: (files: File[], onProgress: (fileIndex: number, percent: number, bytesLoaded: number, bytesTotal: number) => void) => Promise<void>;
  initialFiles?: File[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (newFiles: FileList | null | File[]) => {
    if (!newFiles) return;
    const array = Array.isArray(newFiles) ? newFiles : Array.from(newFiles);
    setConverting(true);
    const processedFiles: File[] = [];

    for (const file of array) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'heic' || ext === 'heif') {
        try {
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
          const convertedBlob = Array.isArray(blob) ? blob[0] : blob;
          const newFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
          processedFiles.push(newFile);
        } catch (err) {
          console.error('HEIC conversion failed:', err);
          processedFiles.push(file);
        }
      } else {
        processedFiles.push(file);
      }
    }

    setFiles(prev => [...prev, ...processedFiles]);
    setConverting(false);
  };

  useEffect(() => {
    if (initialFiles.length > 0) void handleFiles(initialFiles);
  }, []);

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);

    const now = Date.now();
    const initProgress: FileProgress[] = files.map(() => ({
      percent: 0, bytesLoaded: 0, bytesTotal: 0, speed: 0,
      state: 'uploading' as FileUploadState, startTime: now,
    }));
    setFileProgress(initProgress);

    try {
      await onUpload(files, (fileIndex, percent, bytesLoaded, bytesTotal) => {
        setFileProgress(prev => {
          const next = [...prev];
          const entry = next[fileIndex];
          if (!entry) return prev;
          const elapsed = (Date.now() - entry.startTime) / 1000;
          const speed = elapsed > 0 ? bytesLoaded / elapsed : 0;
          next[fileIndex] = {
            ...entry,
            percent,
            bytesLoaded,
            bytesTotal,
            speed,
            state: percent >= 100 ? 'done' : 'uploading',
          };
          return next;
        });
      });
      // Mark all as done
      setFileProgress(prev => prev.map(p => ({ ...p, percent: 100, state: 'done' })));
      setTimeout(() => onClose(), 400);
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      setUploadError(msg);
      setFileProgress(prev => prev.map(p => p.state === 'uploading' ? { ...p, state: 'error', errorMsg: msg } : p));
      setUploading(false);
    }
  };

  const globalPercent = fileProgress.length > 0
    ? Math.round(fileProgress.reduce((s, p) => s + p.percent, 0) / fileProgress.length)
    : 0;

  const totalSpeed = fileProgress.reduce((s, p) => s + (p.state === 'uploading' ? p.speed : 0), 0);

  return (
    <div className="flex flex-col h-screen bg-vault-bg">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
        <button onClick={onClose} disabled={uploading} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors disabled:opacity-40">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-vault-text flex-1">Upload</span>
        {uploading && (
          <span className="text-xs text-vault-muted font-mono">
            {globalPercent}% · {formatSpeed(totalSpeed)}
          </span>
        )}
      </div>

      {/* Global progress bar */}
      {uploading && (
        <div className="h-0.5 bg-vault-border">
          <div
            className="h-full bg-vault-accent transition-all duration-300"
            style={{ width: `${globalPercent}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col px-4 pt-6 pb-6 overflow-y-auto">
        {!uploading && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border border-dashed p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-vault-text bg-vault-elevated' : 'border-vault-border hover:border-vault-muted'
            }`}
          >
            <Upload size={24} className="mx-auto text-vault-muted mb-3" />
            <p className="text-sm text-vault-text">Drop files here or click to browse</p>
            <p className="text-xs text-vault-muted mt-1">JPG, PNG, GIF, HEIC, MP4, MOV · 500MB max</p>
            <input ref={inputRef} type="file" multiple accept="image/*,video/*,.heic,.heif" className="hidden" onChange={e => void handleFiles(e.target.files)} />
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {files.map((f, idx) => {
              const prog = fileProgress[idx];
              const state: FileUploadState = prog?.state ?? 'idle';
              const percent = prog?.percent ?? 0;
              const isImg = f.type.startsWith('image');
              const isVid = f.type.startsWith('video');

              return (
                <div key={`${f.name}-${idx}`} className={`flex items-center gap-3 px-3 py-2.5 border transition-colors ${
                  state === 'error' ? 'border-vault-danger/30 bg-vault-danger/5' :
                  state === 'done' ? 'border-vault-success/20' :
                  'border-vault-border'
                }`}>
                  {/* Thumbnail / type icon */}
                  <div className="w-9 h-9 bg-vault-elevated flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {isImg ? <ImageThumbPreview file={f} /> : isVid ? <VideoThumbPreview file={f} /> : <FileImage size={14} className="text-vault-muted" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-vault-text truncate">{f.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {state === 'idle' && (
                        <p className="text-[10px] text-vault-muted">{formatBytes(f.size)}</p>
                      )}
                      {state === 'uploading' && (
                        <p className="text-[10px] text-vault-muted font-mono">
                          {formatBytes(prog.bytesLoaded)} / {formatBytes(prog.bytesTotal || f.size)} · {formatSpeed(prog.speed)}
                        </p>
                      )}
                      {state === 'done' && (
                        <p className="text-[10px] text-vault-muted">{formatBytes(f.size)} · done</p>
                      )}
                      {state === 'error' && (
                        <p className="text-[10px] text-vault-danger truncate">{prog.errorMsg || 'Failed'}</p>
                      )}
                    </div>
                    {state === 'uploading' && (
                      <div className="mt-1.5 h-0.5 bg-vault-border overflow-hidden">
                        <div
                          className="h-full bg-vault-accent transition-all duration-200"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                    {state === 'done' && (
                      <div className="mt-1.5 h-0.5 bg-vault-success/30">
                        <div className="h-full bg-vault-success w-full" />
                      </div>
                    )}
                  </div>

                  {/* State icon */}
                  <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                    {state === 'idle' && (
                      <button
                        onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, i) => i !== idx)); }}
                        className="w-full h-full flex items-center justify-center text-vault-muted hover:text-vault-text transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                    {state === 'uploading' && (
                      <div className="w-4 h-4 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
                    )}
                    {state === 'done' && <Check size={14} className="text-vault-success" />}
                    {state === 'error' && (
                      <button
                        onClick={() => {
                          setFileProgress(prev => { const n=[...prev]; if(n[idx]) n[idx]={...n[idx], state:'idle', percent:0}; return n; });
                        }}
                        className="text-vault-danger hover:opacity-70 transition-opacity"
                        title="Retry"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {uploadError && !uploading && (
          <p className="mt-3 text-xs text-vault-danger text-center">{uploadError}</p>
        )}

        <div className="mt-auto pt-5 flex gap-2">
          <button onClick={onClose} disabled={uploading} className="flex-1 py-2.5 border border-vault-border text-vault-text text-sm hover:bg-vault-elevated transition-colors disabled:opacity-30">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading || converting}
            className="flex-1 py-2.5 bg-vault-accent text-vault-bg text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            {converting ? 'Converting...' : uploading ? `Uploading ${globalPercent}%` : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Vault Settings ============ */
function VaultSettingsView({ vault, onUpdate, onClose, onDeleteAll, onDestroyVault, onRevokeAccess }: {
  vault: Vault;
  onUpdate: (v: Vault) => Promise<void> | void;
  onClose: () => void;
  onDeleteAll: () => Promise<void> | void;
  onDestroyVault: () => Promise<void> | void;
  onRevokeAccess: () => void;
}) {
  const [name, setName] = useState(vault.name);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [showDanger, setShowDanger] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { showToast } = useToast();

  return (
    <div className="flex flex-col h-screen bg-vault-bg">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-vault-text">Settings</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8">
        <div className="max-w-sm mx-auto space-y-5">
          <div>
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Vault name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 bg-vault-surface border border-vault-border text-vault-text text-sm focus:border-vault-muted focus:outline-none transition-colors" />
          </div>
          <button onClick={() => { void onUpdate({ ...vault, name }); showToast('success', 'Saved'); onClose(); }} className="w-full py-2.5 bg-vault-accent text-vault-bg text-sm font-medium hover:opacity-90 transition-opacity">
            Save
          </button>

          <div className="pt-4 border-t border-vault-border">
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Access management</label>
            <button onClick={() => setConfirmRevoke(true)} className="w-full py-2.5 border border-vault-border text-vault-text text-xs hover:bg-vault-elevated transition-colors">
              Remove from this device
            </button>
            <p className="text-[10px] text-vault-muted mt-2">This will remove the vault from your local storage. You will need the Vault ID and password to access it again.</p>
          </div>

          <div className="pt-4 border-t border-vault-border">
            <button onClick={() => setShowDanger(!showDanger)} className="text-xs text-vault-muted hover:text-vault-danger transition-colors">
              {showDanger ? 'Hide danger zone' : 'Show danger zone'}
            </button>
            {showDanger && (
              <div className="mt-4 space-y-3">
                <button onClick={() => setConfirmClearAll(true)} className="w-full py-2.5 border border-vault-danger/20 text-vault-danger text-xs hover:bg-vault-danger/5 transition-colors">
                  Clear all media
                </button>
                <div>
                  <p className="text-xs text-vault-muted mb-1.5">Type DELETE to destroy vault</p>
                  <input value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} className="w-full px-3 py-2.5 bg-vault-surface border border-vault-border text-vault-text text-sm focus:outline-none" placeholder="DELETE" />
                  <button disabled={confirmDelete !== 'DELETE'} onClick={() => setConfirmDestroy(true)} className="w-full mt-2 py-2.5 bg-vault-danger text-white text-xs font-medium disabled:opacity-20 hover:opacity-90 transition-opacity">
                    Destroy vault
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Remove from device?"
        description="The vault will be removed from your local history, but it will NOT be deleted from the server. You can re-access it anytime with its ID and password."
        confirmLabel="Remove Access"
        onConfirm={() => { onRevokeAccess(); }}
      />

      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={setConfirmClearAll}
        title="Clear all media?"
        description="All media in this vault will be permanently removed. This cannot be undone."
        confirmLabel="Clear all"
        onConfirm={() => { void onDeleteAll(); setConfirmClearAll(false); onClose(); }}
      />
      <ConfirmDialog
        open={confirmDestroy}
        onOpenChange={setConfirmDestroy}
        title="Destroy this vault?"
        description="This vault and all its contents will be permanently destroyed. This cannot be undone."
        confirmLabel="Destroy"
        onConfirm={() => { setConfirmDestroy(false); void onDestroyVault(); }}
      />
    </div>
  );
}

/* ============ Share ============ */
function ShareView({ vaultId, vault, onClose }: { vaultId: string; vault: Vault; onClose: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-vault-bg">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-vault-text">Share</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8">
        <div className="max-w-sm mx-auto space-y-5">
          <div>
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Vault ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-vault-surface border border-vault-border font-mono text-sm text-vault-text">{vaultId}</code>
              <button onClick={() => { navigator.clipboard.writeText(vaultId); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-3 py-2.5 border border-vault-border text-vault-muted hover:text-vault-text transition-colors">
                {copied ? <Check size={16} className="text-vault-success" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-vault-muted mb-1.5 block uppercase tracking-wider">Password</label>
            <div className="flex items-center gap-2">
              <code className={`flex-1 px-3 py-2.5 bg-vault-surface border border-vault-border font-mono text-sm text-vault-text ${!showPw ? 'blur-sm select-none' : ''}`}>
                {vault.password}
              </code>
              <button onClick={() => setShowPw(!showPw)} className="px-3 py-2.5 border border-vault-border text-vault-muted hover:text-vault-text transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <p className="text-xs text-vault-muted">Share the Vault ID and password to give someone access.</p>
        </div>
      </div>
    </div>
  );
}
