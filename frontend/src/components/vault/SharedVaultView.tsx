import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileImage, FileVideo, Play, Star, Grid3X3, List, Search,
  XCircle, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { MediaPreview } from './MediaPreview';
import type { Vault, MediaItem, FilterOption, ViewMode } from './types';

export function SharedVaultView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filter, setFilter] = useState<FilterOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const fetchSharedVault = async () => {
    if (!shareCode) return;
    setRefreshing(true);
    try {
      const res = await api.getSharedVault(shareCode);
      setVault({ ...res.vault, id: 'shared', password: '' });
    } catch (err: any) {
      setError(err.message || 'Shared vault not found');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSharedVault();
  }, [shareCode]);

  const [refreshing, setRefreshing] = useState(false);

  const filteredMedia = useMemo(() => {
    if (!vault) return [];
    let items = [...vault.media];
    
    // Filter
    if (filter === 'images') items = items.filter(m => m.type === 'image');
    if (filter === 'videos') items = items.filter(m => m.type === 'video');
    if (filter === 'starred') items = items.filter(m => m.starred);
    
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(m => m.name.toLowerCase().includes(q));
    }
    
    return items;
  }, [vault, filter, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-vault-bg gap-4">
        <div className="w-10 h-10 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] text-vault-muted uppercase tracking-[0.2em] font-medium">Accessing Shared Vault...</p>
      </div>
    );
  }

  if (error || !vault) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-vault-bg px-6 text-center">
        <div className="w-16 h-16 bg-vault-elevated flex items-center justify-center mb-6">
          <XCircle size={32} className="text-vault-danger/50" />
        </div>
        <h1 className="text-xl font-bold text-vault-text mb-2">Vault Unreachable</h1>
        <p className="text-sm text-vault-muted max-w-xs">{error || 'This share link might have expired or is incorrect.'}</p>
        <button onClick={() => window.location.href = '/'} className="mt-8 px-6 py-2.5 bg-vault-accent text-vault-bg text-sm font-bold uppercase tracking-wider">
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-vault-bg relative">
      {previewIndex !== null && filteredMedia[previewIndex] && (
        <MediaPreview
          item={filteredMedia[previewIndex]}
          onClose={() => setPreviewIndex(null)}
          onNext={() => setPreviewIndex(previewIndex + 1)}
          onPrev={() => setPreviewIndex(previewIndex - 1)}
          hasNext={previewIndex < filteredMedia.length - 1}
          hasPrev={previewIndex > 0}
          currentIndex={previewIndex}
          totalCount={filteredMedia.length}
        />
      )}

      {/* Header */}
      <div className="flex-shrink-0 border-b border-vault-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-vault-text truncate">{vault.name}</p>
            <p className="text-[10px] text-vault-muted uppercase tracking-wider">Shared View (Read-Only)</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen(!searchOpen)} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
              <Search size={18} />
            </button>
            <button 
              onClick={fetchSharedVault} 
              disabled={refreshing}
              title="Sync media"
              className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors disabled:opacity-40"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="w-9 h-9 flex items-center justify-center text-vault-text hover:bg-vault-elevated transition-colors">
              {viewMode === 'grid' ? <List size={18} /> : <Grid3X3 size={18} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-vault-elevated/30"
            >
              <div className="px-4 py-3">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search shared media..."
                  className="w-full bg-transparent text-sm text-vault-text placeholder:text-vault-muted focus:outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-6 px-4 h-11 overflow-x-auto no-scrollbar">
          {(['all', 'images', 'videos', 'starred'] as FilterOption[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`relative h-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
                filter === f ? 'text-vault-accent' : 'text-vault-muted hover:text-vault-text'
              }`}
            >
              {f}
              {filter === f && (
                <motion.div layoutId="shared-active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-vault-accent" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
        {filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-vault-muted opacity-30 gap-3">
            <FileImage size={40} strokeWidth={1} />
            <p className="text-xs uppercase tracking-widest">No shared media</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            {filteredMedia.map((m, idx) => (
              <div 
                key={m.id} 
                onClick={() => setPreviewIndex(idx)}
                className="aspect-square bg-vault-elevated group cursor-pointer overflow-hidden relative border border-vault-border hover:border-vault-muted transition-colors"
              >
                {m.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <SharedVideoThumb media={m} />
                    <div className="absolute top-2 right-2 p-1 bg-black/40 rounded-full">
                      <Play size={10} className="text-white fill-white" />
                    </div>
                  </div>
                ) : (
                  <SharedVaultImage media={m} />
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                {m.starred && <Star size={10} className="absolute top-2 left-2 text-vault-accent fill-vault-accent" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredMedia.map((m, idx) => (
              <div 
                key={m.id}
                onClick={() => setPreviewIndex(idx)}
                className="flex items-center gap-4 p-2 bg-vault-elevated/50 border border-vault-border hover:border-vault-muted cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 flex-shrink-0 bg-vault-elevated flex items-center justify-center">
                  {m.type === 'image' ? <SharedVaultImage media={m} /> : <Play size={16} className="text-vault-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-vault-text truncate">{m.name}</p>
                  <p className="text-[10px] text-vault-muted mt-0.5">{m.size} • {m.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-implement simplified versions of VaultImage and VideoThumb for SharedView
// to avoid heavy dependencies or complexity in the shared page

function SharedVaultImage({ media }: { media: MediaItem }) {
  const displayUrl = media.url ? toDisplayUrl(media.url, media.name) : null;
  if (!displayUrl) return <div className="w-full h-full bg-vault-elevated animate-pulse" />;
  return <img src={displayUrl} alt={media.name} className="w-full h-full object-cover" loading="lazy" />;
}

function SharedVideoThumb({ media: _media }: { media: MediaItem }) {
  // For shared view, just show a placeholder or try to extract if possible
  // Keeping it simple for now
  return <div className="w-full h-full flex items-center justify-center"><FileVideo size={24} className="text-vault-muted" /></div>;
}

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
