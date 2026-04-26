export type ViewState = 'home' | 'create' | 'access' | 'vault-open';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  name: string;
  size: string;
  date: string;
  starred: boolean;
  url: string | null;
  duration?: string;
}

export interface Vault {
  id: string;
  name: string;
  description?: string;
  password: string;
  media: MediaItem[];
  themeColor: string;
  shareCode?: string;
  shareEnabled?: boolean;
  shareConfig?: {
    type: 'full' | 'selected';
    sharedIds: string[];
  };
}

export type VaultMap = Record<string, Vault>;

export type SortOption = 'newest' | 'oldest' | 'name' | 'size';
export type FilterOption = 'all' | 'images' | 'videos' | 'starred' | 'recent';
export type ViewMode = 'grid' | 'list';
