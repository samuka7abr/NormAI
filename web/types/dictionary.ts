export type EntryKind = "categories" | "context";

// Shape used by new-project-page (matches raw API field names)
export type DictType = EntryKind;
export interface DictEntry {
  id: string;
  type: DictType;
  title: string;
  description: string;
  content: string | null;
  items: string[] | null;
}

export interface DictionaryEntry {
  id: string;
  kind: EntryKind;
  name: string;
  description: string;
  usedIn: string[];
  updatedAt: string;      // ISO 8601
  items: string[] | null;
  content: string | null;
}

export interface DictionaryPage {
  items: DictionaryEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateEntryInput {
  kind: EntryKind;
  name: string;
  description?: string;
  items?: string[];
  content?: string;
}

export interface UpdateEntryInput {
  name?: string;
  description?: string;
  items?: string[];
  content?: string;
}
