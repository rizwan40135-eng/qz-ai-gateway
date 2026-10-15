export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          alias: string
          business_unit: string | null
          conditions: Json | null
          created_at: string | null
          data_class: string | null
          decided_at: string | null
          decided_by: string | null
          duration_days: number | null
          environment: string | null
          expected_spend: number | null
          expected_tokens: number | null
          id: string
          justification: string | null
          kind: string | null
          note: string | null
          outcome: string | null
          preflight: Json | null
          project_id: string | null
          requester_id: string | null
          requester_name: string | null
          status: string | null
          team: string | null
          use_case: string | null
        }
        Insert: {
          alias: string
          business_unit?: string | null
          conditions?: Json | null
          created_at?: string | null
          data_class?: string | null
          decided_at?: string | null
          decided_by?: string | null
          duration_days?: number | null
          environment?: string | null
          expected_spend?: number | null
          expected_tokens?: number | null
          id?: string
          justification?: string | null
          kind?: string | null
          note?: string | null
          outcome?: string | null
          preflight?: Json | null
          project_id?: string | null
          requester_id?: string | null
          requester_name?: string | null
          status?: string | null
          team?: string | null
          use_case?: string | null
        }
        Update: {
          alias?: string
          business_unit?: string | null
          conditions?: Json | null
          created_at?: string | null
          data_class?: string | null
          decided_at?: string | null
          decided_by?: string | null
          duration_days?: number | null
          environment?: string | null
          expected_spend?: number | null
          expected_tokens?: number | null
          id?: string
          justification?: string | null
          kind?: string | null
          note?: string | null
          outcome?: string | null
          preflight?: Json | null
          project_id?: string | null
          requester_id?: string | null
          requester_name?: string | null
          status?: string | null
          team?: string | null
          use_case?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          assignee: string | null
          created_at: string | null
          detail: string | null
          id: string
          severity: string | null
          snoozed_until: string | null
          status: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          assignee?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          severity?: string | null
          snoozed_until?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          assignee?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          severity?: string | null
          snoozed_until?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      alias_versions: {
        Row: {
          alias: string | null
          created_at: string | null
          created_by: string | null
          fallback_model: string | null
          id: string
          note: string | null
          primary_model: string | null
          status: string | null
          strategy: string | null
          version: number | null
        }
        Insert: {
          alias?: string | null
          created_at?: string | null
          created_by?: string | null
          fallback_model?: string | null
          id?: string
          note?: string | null
          primary_model?: string | null
          status?: string | null
          strategy?: string | null
          version?: number | null
        }
        Update: {
          alias?: string | null
          created_at?: string | null
          created_by?: string | null
          fallback_model?: string | null
          id?: string
          note?: string | null
          primary_model?: string | null
          status?: string | null
          strategy?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alias_versions_alias_fkey"
            columns: ["alias"]
            isOneToOne: false
            referencedRelation: "aliases"
            referencedColumns: ["alias"]
          },
        ]
      }
      aliases: {
        Row: {
          alias: string
          environments: string[] | null
          fallback_model: string | null
          latency_ms: number | null
          max_class: string | null
          primary_model: string | null
          purpose: string | null
          retries: number | null
          status: string | null
          strategy: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          alias: string
          environments?: string[] | null
          fallback_model?: string | null
          latency_ms?: number | null
          max_class?: string | null
          primary_model?: string | null
          purpose?: string | null
          retries?: number | null
          status?: string | null
          strategy?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          alias?: string
          environments?: string[] | null
          fallback_model?: string | null
          latency_ms?: number | null
          max_class?: string | null
          primary_model?: string | null
          purpose?: string | null
          retries?: number | null
          status?: string | null
          strategy?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aliases_fallback_model_fkey"
            columns: ["fallback_model"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aliases_primary_model_fkey"
            columns: ["primary_model"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          business_unit: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          team: string | null
        }
        Insert: {
          business_unit?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          team?: string | null
        }
        Update: {
          business_unit?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          team?: string | null
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string | null
          actor: string | null
          approval: string | null
          created_at: string | null
          id: string
          new_value: string | null
          prev_value: string | null
          reason: string | null
          request_id: string | null
          resource: string | null
        }
        Insert: {
          action?: string | null
          actor?: string | null
          approval?: string | null
          created_at?: string | null
          id?: string
          new_value?: string | null
          prev_value?: string | null
          reason?: string | null
          request_id?: string | null
          resource?: string | null
        }
        Update: {
          action?: string | null
          actor?: string | null
          approval?: string | null
          created_at?: string | null
          id?: string
          new_value?: string | null
          prev_value?: string | null
          reason?: string | null
          request_id?: string | null
          resource?: string | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          alias: string
          created_at: string | null
          endpoints: string[] | null
          environment: string
          exception: boolean | null
          expires_at: string | null
          id: string
          logging: string | null
          max_class: string
          monthly_budget: number | null
          project_id: string | null
          request_id: string | null
          rpm: number | null
          spent_usd: number | null
          status: string | null
          tpm: number | null
        }
        Insert: {
          alias: string
          created_at?: string | null
          endpoints?: string[] | null
          environment: string
          exception?: boolean | null
          expires_at?: string | null
          id?: string
          logging?: string | null
          max_class: string
          monthly_budget?: number | null
          project_id?: string | null
          request_id?: string | null
          rpm?: number | null
          spent_usd?: number | null
          status?: string | null
          tpm?: number | null
        }
        Update: {
          alias?: string
          created_at?: string | null
          endpoints?: string[] | null
          environment?: string
          exception?: boolean | null
          expires_at?: string | null
          id?: string
          logging?: string | null
          max_class?: string
          monthly_budget?: number | null
          project_id?: string | null
          request_id?: string | null
          rpm?: number | null
          spent_usd?: number | null
          status?: string | null
          tpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_sets: {
        Row: {
          category: string | null
          created_at: string | null
          criteria: string | null
          id: string
          last_run: Json | null
          name: string | null
          owner: string | null
          project: string | null
          prompts: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          criteria?: string | null
          id?: string
          last_run?: Json | null
          name?: string | null
          owner?: string | null
          project?: string | null
          prompts?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          criteria?: string | null
          id?: string
          last_run?: Json | null
          name?: string | null
          owner?: string | null
          project?: string | null
          prompts?: Json | null
        }
        Relationships: []
      }
      gateway_keys: {
        Row: {
          aliases: string[] | null
          budget: number | null
          created_at: string | null
          environment: string | null
          expires_at: string | null
          id: string
          key_hash: string | null
          kind: string | null
          last_used: string | null
          last4: string
          name: string
          owner_id: string | null
          owner_name: string | null
          prefix: string
          project_id: string | null
          requests: number | null
          rpm: number | null
          rpm_count: number | null
          rpm_window_start: string | null
          scopes: string[] | null
          spend: number | null
          status: string | null
          tokens: number | null
        }
        Insert: {
          aliases?: string[] | null
          budget?: number | null
          created_at?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string | null
          kind?: string | null
          last_used?: string | null
          last4: string
          name: string
          owner_id?: string | null
          owner_name?: string | null
          prefix: string
          project_id?: string | null
          requests?: number | null
          rpm?: number | null
          rpm_count?: number | null
          rpm_window_start?: string | null
          scopes?: string[] | null
          spend?: number | null
          status?: string | null
          tokens?: number | null
        }
        Update: {
          aliases?: string[] | null
          budget?: number | null
          created_at?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string | null
          kind?: string | null
          last_used?: string | null
          last4?: string
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          prefix?: string
          project_id?: string | null
          requests?: number | null
          rpm?: number | null
          rpm_count?: number | null
          rpm_window_start?: string | null
          scopes?: string[] | null
          spend?: number | null
          status?: string | null
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      governance: {
        Row: {
          aliases: string | null
          budget_usd: number | null
          data_class: string | null
          enforcement: string | null
          environment: string | null
          key_expiry_days: number | null
          logging: string | null
          rpm: number | null
          spent_usd: number | null
          team: string
          tpm: number | null
        }
        Insert: {
          aliases?: string | null
          budget_usd?: number | null
          data_class?: string | null
          enforcement?: string | null
          environment?: string | null
          key_expiry_days?: number | null
          logging?: string | null
          rpm?: number | null
          spent_usd?: number | null
          team: string
          tpm?: number | null
        }
        Update: {
          aliases?: string | null
          budget_usd?: number | null
          data_class?: string | null
          enforcement?: string | null
          environment?: string | null
          key_expiry_days?: number | null
          logging?: string | null
          rpm?: number | null
          spent_usd?: number | null
          team?: string
          tpm?: number | null
        }
        Relationships: []
      }
      matrix: {
        Row: {
          alias: string
          environment: string
          state: string
          team: string
        }
        Insert: {
          alias: string
          environment: string
          state: string
          team: string
        }
        Update: {
          alias?: string
          environment?: string
          state?: string
          team?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          cached_price: number | null
          capabilities: string[] | null
          context_window: number | null
          error_rate: number | null
          id: string
          input_price: number | null
          latency_ms: number | null
          max_class: string | null
          output_price: number | null
          provider_id: string | null
          provider_model: string
          region: string | null
          simulated_outage: boolean | null
          status: string | null
          streaming: boolean | null
          structured: boolean | null
          tools: boolean | null
          vision: boolean | null
        }
        Insert: {
          cached_price?: number | null
          capabilities?: string[] | null
          context_window?: number | null
          error_rate?: number | null
          id: string
          input_price?: number | null
          latency_ms?: number | null
          max_class?: string | null
          output_price?: number | null
          provider_id?: string | null
          provider_model: string
          region?: string | null
          simulated_outage?: boolean | null
          status?: string | null
          streaming?: boolean | null
          structured?: boolean | null
          tools?: boolean | null
          vision?: boolean | null
        }
        Update: {
          cached_price?: number | null
          capabilities?: string[] | null
          context_window?: number | null
          error_rate?: number | null
          id?: string
          input_price?: number | null
          latency_ms?: number | null
          max_class?: string | null
          output_price?: number | null
          provider_id?: string | null
          provider_model?: string
          region?: string | null
          simulated_outage?: boolean | null
          status?: string | null
          streaming?: boolean | null
          structured?: boolean | null
          tools?: boolean | null
          vision?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          action: string
          condition: Json | null
          description: string | null
          enabled: boolean | null
          id: string
          layer: string
          name: string
          origin: string | null
          updated_at: string | null
        }
        Insert: {
          action: string
          condition?: Json | null
          description?: string | null
          enabled?: boolean | null
          id: string
          layer: string
          name: string
          origin?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          condition?: Json | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          layer?: string
          name?: string
          origin?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing: {
        Row: {
          cached_price: number | null
          currency: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          input_price: number | null
          model: string | null
          output_price: number | null
          provider: string | null
          unit: string | null
        }
        Insert: {
          cached_price?: number | null
          currency?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          input_price?: number | null
          model?: string | null
          output_price?: number | null
          provider?: string | null
          unit?: string | null
        }
        Update: {
          cached_price?: number | null
          currency?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          input_price?: number | null
          model?: string | null
          output_price?: number | null
          provider?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          app_name: string | null
          budget_usd: number | null
          business_unit: string
          cost_center: string | null
          created_at: string | null
          data_class: string
          description: string | null
          environment: string
          expected_requests: number | null
          expected_tokens: number | null
          id: string
          name: string
          owner_id: string | null
          owner_name: string | null
          seeded: boolean | null
          spent_usd: number | null
          status: string | null
          team: string
          use_case: string | null
        }
        Insert: {
          app_name?: string | null
          budget_usd?: number | null
          business_unit: string
          cost_center?: string | null
          created_at?: string | null
          data_class: string
          description?: string | null
          environment: string
          expected_requests?: number | null
          expected_tokens?: number | null
          id?: string
          name: string
          owner_id?: string | null
          owner_name?: string | null
          seeded?: boolean | null
          spent_usd?: number | null
          status?: string | null
          team: string
          use_case?: string | null
        }
        Update: {
          app_name?: string | null
          budget_usd?: number | null
          business_unit?: string
          cost_center?: string | null
          created_at?: string | null
          data_class?: string
          description?: string | null
          environment?: string
          expected_requests?: number | null
          expected_tokens?: number | null
          id?: string
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          seeded?: boolean | null
          spent_usd?: number | null
          status?: string | null
          team?: string
          use_case?: string | null
        }
        Relationships: []
      }
      provider_secrets: {
        Row: {
          created_at: string | null
          provider_id: string
          secret: string
          slot: string
        }
        Insert: {
          created_at?: string | null
          provider_id: string
          secret: string
          slot: string
        }
        Update: {
          created_at?: string | null
          provider_id?: string
          secret?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_secrets_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          auth: string | null
          base_url: string | null
          error_rate: number | null
          external: boolean | null
          id: string
          kind: string
          latency_ms: number | null
          name: string
          pending_secret_last4: string | null
          region: string | null
          restricted_ok: boolean | null
          secret_last4: string | null
          secret_rotated_at: string | null
          secret_status: string | null
          simulated_outage: boolean | null
          status: string | null
        }
        Insert: {
          auth?: string | null
          base_url?: string | null
          error_rate?: number | null
          external?: boolean | null
          id: string
          kind: string
          latency_ms?: number | null
          name: string
          pending_secret_last4?: string | null
          region?: string | null
          restricted_ok?: boolean | null
          secret_last4?: string | null
          secret_rotated_at?: string | null
          secret_status?: string | null
          simulated_outage?: boolean | null
          status?: string | null
        }
        Update: {
          auth?: string | null
          base_url?: string | null
          error_rate?: number | null
          external?: boolean | null
          id?: string
          kind?: string
          latency_ms?: number | null
          name?: string
          pending_secret_last4?: string | null
          region?: string | null
          restricted_ok?: boolean | null
          secret_last4?: string | null
          secret_rotated_at?: string | null
          secret_status?: string | null
          simulated_outage?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
      traces: {
        Row: {
          alias: string | null
          cost: number | null
          created_at: string | null
          endpoint: string | null
          environment: string | null
          error_code: string | null
          fallback: boolean | null
          id: string
          input_tokens: number | null
          key_prefix: string | null
          latency_ms: number | null
          logging: string | null
          model: string | null
          output_tokens: number | null
          policy_id: string | null
          policy_result: string | null
          project_name: string | null
          provider: string | null
          request_preview: string | null
          response_preview: string | null
          simulated: boolean | null
          status: number | null
          steps: Json | null
          team: string | null
          ttft_ms: number | null
          usage_estimated: boolean | null
          user_name: string | null
        }
        Insert: {
          alias?: string | null
          cost?: number | null
          created_at?: string | null
          endpoint?: string | null
          environment?: string | null
          error_code?: string | null
          fallback?: boolean | null
          id: string
          input_tokens?: number | null
          key_prefix?: string | null
          latency_ms?: number | null
          logging?: string | null
          model?: string | null
          output_tokens?: number | null
          policy_id?: string | null
          policy_result?: string | null
          project_name?: string | null
          provider?: string | null
          request_preview?: string | null
          response_preview?: string | null
          simulated?: boolean | null
          status?: number | null
          steps?: Json | null
          team?: string | null
          ttft_ms?: number | null
          usage_estimated?: boolean | null
          user_name?: string | null
        }
        Update: {
          alias?: string | null
          cost?: number | null
          created_at?: string | null
          endpoint?: string | null
          environment?: string | null
          error_code?: string | null
          fallback?: boolean | null
          id?: string
          input_tokens?: number | null
          key_prefix?: string | null
          latency_ms?: number | null
          logging?: string | null
          model?: string | null
          output_tokens?: number | null
          policy_id?: string | null
          policy_result?: string | null
          project_name?: string | null
          provider?: string | null
          request_preview?: string | null
          response_preview?: string | null
          simulated?: boolean | null
          status?: number | null
          steps?: Json | null
          team?: string | null
          ttft_ms?: number | null
          usage_estimated?: boolean | null
          user_name?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
