import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Upload, Star, Play, X, Grid3X3, List,
  CheckSquare, Square, FileImage, FileVideo, Check, MoreHorizontal,
  Copy, Eye, EyeOff,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { MediaPreview } from './MediaPreview';
import type { Vault, FilterOption, SortOption, ViewMode, MediaItem } from './types';
import heic2any from 'heic2any';

function VaultImage({ media, className, onClick }: { media: MediaItem; className?: string; onClick?: (e: any) => void }) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!media.url) return;
    
    // Determine absolute URL
    const isAbsolute = media.url.startsWith('http') || media.url.startsWith('blob:');
    const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
    const fullUrl = isAbsolute ? media.url : `${apiBase}${media.url}`;

    const isHeic = /\.(heic|heif)$/i.test(media.name);
    
    if (isHeic) {
      console.log(`[VaultImage] Converting HEIC: ${media.name}`);
      setLoading(true);
      fetch(fullUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          console.log(`[VaultImage] Blob fetched, starting conversion for ${media.name}`);
          return heic2any({ blob, toType: 'image/jpeg', quality: 0.7 });
        })
        .then(converted => {
          const blobUrl = URL.createObjectURL(Array.isArray(converted) ? converted[0] : converted);
          console.log(`[VaultImage] Conversion successful: ${blobUrl}`);
          setDisplayUrl(blobUrl);
          setLoading(false);
        })
        .catch(err => {
          console.error(`[VaultImage] HEIC conversion failed for ${media.name}:`, err);
          setDisplayUrl(fullUrl);
          setLoading(false);
        });
        
      return () => {
        if (displayUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(displayUrl);
        }
      };
    } else {
      setDisplayUrl(fullUrl);
    }
  }, [media.url, media.name]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-vault-elevated gap-2 ${className}`}>
        <div className="w-5 h-5 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-[8px] text-vault-muted uppercase tracking-tight">Processing</span>
      </div>
    );
  }

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
        console.error(`[VaultImage] Image load error for ${media.name} at ${displayUrl}`);
        // If it's a Cloudinary HEIC, try to force JPG format if it failed before
        if (displayUrl.includes('cloudinary') && displayUrl.toLowerCase().endsWith('.heic')) {
          const fallback = displayUrl.replace(/\.heic$/i, '.jpg');
          (e.target as HTMLImageElement).src = fallback;
        }
      }}
    />
  );
}




interface Props {
  vaultId: string;
  vault: Vault;
  onLock: () => void;
  onUpdateVault: (v: Vault) => Promise<void> | void;
  onDeleteVault: () => Promise<void> | void;
  onClearAllMedia: () => Promise<void> | void;
  onRemoveMedia: (ids: string[]) => Promise<void> | void;
  onToggleStar: (mediaId: string) => Promise<void> | void;
  onUploadMedia: (files: File[], onProgress?: (p: number) => void) => Promise<void> | void;
  onRevokeAccess: () => void;
  theme: string;
  setTheme: (t: string) => void;
}

export function VaultInteriorView({
  vaultId,
  vault,
  onLock,
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
            <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} className={`w-8 h-8 flex items-center justify-center transition-colors ${selectMode ? 'text-vault-text' : 'text-vault-muted hover:text-vault-text'}`}>
              <CheckSquare size={16} />
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
                <div className="w-10 h-10 overflow-hidden bg-vault-elevated flex-shrink-0">
                  {isImage(item) && item.url ? (
                    <VaultImage media={item} className="w-full h-full object-cover" />
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
function UploadView({ onClose, onUpload, initialFiles = [] }: { onClose: () => void; onUpload: (files: File[], onProgress: (p: number) => void) => Promise<void>; initialFiles?: File[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
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
    if (initialFiles.length > 0) {
      void handleFiles(initialFiles);
    }
  }, []);


  const handleUpload = async () => {
    setUploading(true);
    setGlobalProgress(0);
    try {
      await onUpload(files, (p) => {
        setGlobalProgress(p);
      });
      onClose();
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-vault-bg">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-vault-border">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-medium text-vault-text">Upload</span>
      </div>
      <div className="flex-1 flex flex-col px-4 pt-6 pb-6 overflow-y-auto">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border border-dashed p-12 text-center cursor-pointer transition-colors ${
            dragging ? 'border-vault-text bg-vault-elevated' : 'border-vault-border hover:border-vault-muted'
          }`}
        >
          <Upload size={24} className="mx-auto text-vault-muted mb-3" />
          <p className="text-sm text-vault-text">Drop files here or click to browse</p>
          <p className="text-xs text-vault-muted mt-1">JPG, PNG, GIF, HEIC, MP4, MOV · 500MB max</p>
          <input ref={inputRef} type="file" multiple accept="image/*,video/*,.heic,.heif" className="hidden" onChange={e => void handleFiles(e.target.files)} />
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-1">
            {files.map(f => (
              <div key={f.name} className="flex items-center gap-3 px-3 py-2.5 border border-vault-border">
                <div className="w-8 h-8 bg-vault-elevated flex items-center justify-center flex-shrink-0">
                  {f.type.startsWith('image') ? <FileImage size={14} className="text-vault-muted" /> : <FileVideo size={14} className="text-vault-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-vault-text truncate">{f.name}</p>
                  <p className="text-[10px] text-vault-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                  {uploading && (
                    <div className="mt-1 h-0.5 bg-vault-border overflow-hidden">
                      <div className="h-full bg-vault-text transition-all duration-200" style={{ width: `${globalProgress}%` }} />
                    </div>
                  )}
                </div>
                {!uploading && (
                  <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter(x => x !== f)); }} className="w-7 h-7 flex items-center justify-center text-vault-muted hover:text-vault-text">
                    <X size={14} />
                  </button>
                )}
                {uploading && globalProgress >= 100 && <Check size={14} className="text-vault-success" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-vault-border text-vault-text text-sm hover:bg-vault-elevated transition-colors">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading || converting}
            className="flex-1 py-2.5 bg-vault-accent text-vault-bg text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            {converting ? 'Converting...' : uploading ? 'Uploading...' : `Upload ${files.length}`}
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
