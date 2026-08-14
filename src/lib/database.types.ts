export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProcessingStage =
  "uploaded" | "extracting" | "chunking" | "embedding" | "ready" | "failed";

export type Database = {
  public: {
    Tables: {
      citations: {
        Row: {
          id: string;
          answer_message_id: string;
          passage_id: string | null;
          display_order: number;
          source_title: string;
          passage_content: string;
          page_number: number | null;
          paragraph_start: number | null;
          paragraph_end: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          answer_message_id: string;
          passage_id?: string | null;
          display_order: number;
          source_title: string;
          passage_content: string;
          page_number?: number | null;
          paragraph_start?: number | null;
          paragraph_end?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["citations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "citations_answer_message_id_fkey";
            columns: ["answer_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citations_passage_id_fkey";
            columns: ["passage_id"];
            isOneToOne: false;
            referencedRelation: "passages";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          notebook_id: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          notebook_id: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["conversations"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "conversations_notebook_id_fkey";
            columns: ["notebook_id"];
            isOneToOne: false;
            referencedRelation: "notebooks";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          reply_to_message_id: string | null;
          ordinal: number;
          role: "question" | "answer";
          content: string;
          status: "pending" | "completed" | "failed";
          answer_kind:
            "grounded" | "insufficient_evidence" | "safe_failure" | null;
          evidence_passage_ids: string[];
          correlation_id: string;
          model_provider: string | null;
          model_name: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          reply_to_message_id?: string | null;
          ordinal?: never;
          role: "question" | "answer";
          content: string;
          status: "pending" | "completed" | "failed";
          answer_kind?:
            "grounded" | "insufficient_evidence" | "safe_failure" | null;
          evidence_passage_ids?: string[];
          correlation_id?: string;
          model_provider?: string | null;
          model_name?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey";
            columns: ["reply_to_message_id"];
            isOneToOne: true;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
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
          processing_stage: ProcessingStage;
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
          processing_stage?: ProcessingStage;
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
    Functions: {
      begin_grounded_question: {
        Args: {
          target_guest_id: string;
          target_notebook_id: string;
          question_content: string;
          request_correlation_id: string;
        };
        Returns: {
          conversation_id: string;
          question_id: string;
          answer_id: string;
        }[];
      };
      begin_question: {
        Args: {
          target_notebook_id: string;
          question_content: string;
          request_correlation_id: string;
        };
        Returns: {
          conversation_id: string;
          question_id: string;
          answer_id: string;
        }[];
      };
      complete_answer: {
        Args: {
          target_answer_id: string;
          answer_content: string;
          completion_kind: "grounded" | "insufficient_evidence";
          completion_provider: string | null;
          completion_model: string | null;
          cited_passage_ids?: string[];
        };
        Returns: undefined;
      };
      complete_grounded_answer: {
        Args: {
          target_guest_id: string;
          target_answer_id: string;
          answer_content: string;
          completion_kind: "grounded" | "insufficient_evidence";
          completion_provider: string | null;
          completion_model: string | null;
          cited_passage_ids?: string[];
        };
        Returns: undefined;
      };
      fail_answer: {
        Args: { target_answer_id: string };
        Returns: undefined;
      };
      fail_grounded_answer: {
        Args: { target_guest_id: string; target_answer_id: string };
        Returns: undefined;
      };
      record_grounded_evidence: {
        Args: {
          target_guest_id: string;
          target_question_id: string;
          evidence_ids: string[];
        };
        Returns: undefined;
      };
      retrieve_grounded_passages: {
        Args: {
          target_guest_id: string;
          target_notebook_id: string;
          question_embedding: string;
          match_count?: number;
          minimum_similarity?: number;
        };
        Returns: {
          passage_id: string;
          source_id: string;
          source_title: string;
          source_kind: "pdf" | "pasted_text";
          content: string;
          page_number: number | null;
          paragraph_start: number | null;
          paragraph_end: number | null;
          similarity: number;
        }[];
      };
      retrieve_passages: {
        Args: {
          target_notebook_id: string;
          question_embedding: string;
          match_count?: number;
          minimum_similarity?: number;
        };
        Returns: {
          passage_id: string;
          source_id: string;
          source_title: string;
          source_kind: "pdf" | "pasted_text";
          content: string;
          page_number: number | null;
          paragraph_start: number | null;
          paragraph_end: number | null;
          similarity: number;
        }[];
      };
      set_question_evidence: {
        Args: { target_question_id: string; evidence_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
