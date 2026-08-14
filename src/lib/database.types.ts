export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      notebooks: {
        Row: {
          id: string;
          owner_id: string | null;
          is_example: boolean;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          is_example?: boolean;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          is_example?: boolean;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          notebook_id: string;
          title: string;
          kind: "pdf" | "pasted_text";
          original_url: string | null;
          attribution: string;
          license_name: string;
          license_url: string;
          content: string;
          processing_stage: "ready";
          embedding_provider: string;
          embedding_model: string;
          embedding_dimensions: number;
          embedding_pooling: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          notebook_id: string;
          title: string;
          kind: "pdf" | "pasted_text";
          original_url?: string | null;
          attribution: string;
          license_name: string;
          license_url: string;
          content: string;
          processing_stage?: "ready";
          embedding_provider: string;
          embedding_model: string;
          embedding_dimensions: number;
          embedding_pooling: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sources_notebook_id_fkey";
            columns: ["notebook_id"];
            isOneToOne: false;
            referencedRelation: "notebooks";
            referencedColumns: ["id"];
          },
        ];
      };
      passages: {
        Row: {
          id: string;
          source_id: string;
          ordinal: number;
          content: string;
          page_number: number | null;
          paragraph_start: number | null;
          paragraph_end: number | null;
          embedding: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          ordinal: number;
          content: string;
          page_number?: number | null;
          paragraph_start?: number | null;
          paragraph_end?: number | null;
          embedding: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["passages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "passages_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
