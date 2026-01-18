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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          author: string
          category: string
          content: string
          created_at: string
          helpful_no: number
          helpful_yes: number
          id: string
          reading_time_minutes: number
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          views_count: number
          visibility: string
        }
        Insert: {
          author: string
          category: string
          content: string
          created_at?: string
          helpful_no?: number
          helpful_yes?: number
          id?: string
          reading_time_minutes?: number
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          views_count?: number
          visibility?: string
        }
        Update: {
          author?: string
          category?: string
          content?: string
          created_at?: string
          helpful_no?: number
          helpful_yes?: number
          id?: string
          reading_time_minutes?: number
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          views_count?: number
          visibility?: string
        }
        Relationships: []
      }
      cert_asset_access: {
        Row: {
          asset_id: string
          created_at: string
          host: string | null
          id: string
          instrucoes: string | null
          porta: number | null
          senha_ref: string | null
          tipo: string
          updated_at: string
          usuario: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          host?: string | null
          id?: string
          instrucoes?: string | null
          porta?: number | null
          senha_ref?: string | null
          tipo: string
          updated_at?: string
          usuario?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          host?: string | null
          id?: string
          instrucoes?: string | null
          porta?: number | null
          senha_ref?: string | null
          tipo?: string
          updated_at?: string
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_asset_access_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cert_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_asset_disks: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          label: string | null
          mount_point: string | null
          tamanho_gb: number
          tipo: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          label?: string | null
          mount_point?: string | null
          tamanho_gb: number
          tipo?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          label?: string | null
          mount_point?: string | null
          tamanho_gb?: number
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_asset_disks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cert_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_asset_licenses: {
        Row: {
          asset_id: string
          created_at: string
          descricao: string
          id: string
          quantidade: number | null
          validade: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          descricao: string
          id?: string
          quantidade?: number | null
          validade?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          descricao?: string
          id?: string
          quantidade?: number | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_asset_licenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cert_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_asset_network: {
        Row: {
          asset_id: string
          created_at: string
          descricao: string | null
          id: string
          ip_address: string
          is_primary: boolean | null
          tipo: string | null
          vlan: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          ip_address: string
          is_primary?: boolean | null
          tipo?: string | null
          vlan?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ip_address?: string
          is_primary?: boolean | null
          tipo?: string | null
          vlan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_asset_network_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cert_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_asset_resources: {
        Row: {
          asset_id: string
          backup_ativo: boolean | null
          backup_janela: string | null
          backup_retencao_dias: number | null
          created_at: string
          firewall_ativo: boolean | null
          id: string
          ram_gb: number | null
          servicos_adicionais: string[] | null
          updated_at: string
          vcpu: number | null
        }
        Insert: {
          asset_id: string
          backup_ativo?: boolean | null
          backup_janela?: string | null
          backup_retencao_dias?: number | null
          created_at?: string
          firewall_ativo?: boolean | null
          id?: string
          ram_gb?: number | null
          servicos_adicionais?: string[] | null
          updated_at?: string
          vcpu?: number | null
        }
        Update: {
          asset_id?: string
          backup_ativo?: boolean | null
          backup_janela?: string | null
          backup_retencao_dias?: number | null
          created_at?: string
          firewall_ativo?: boolean | null
          id?: string
          ram_gb?: number | null
          servicos_adicionais?: string[] | null
          updated_at?: string
          vcpu?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_asset_resources_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "cert_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_assets: {
        Row: {
          asset_code: string
          created_at: string
          customer_id: string
          datacenter: Database["public"]["Enums"]["cert_datacenter"]
          hostname: string | null
          id: string
          observacoes: string | null
          sistema_operacional: string | null
          status: Database["public"]["Enums"]["cert_asset_status"] | null
          tipo: Database["public"]["Enums"]["cert_asset_type"]
          updated_at: string
        }
        Insert: {
          asset_code: string
          created_at?: string
          customer_id: string
          datacenter: Database["public"]["Enums"]["cert_datacenter"]
          hostname?: string | null
          id?: string
          observacoes?: string | null
          sistema_operacional?: string | null
          status?: Database["public"]["Enums"]["cert_asset_status"] | null
          tipo: Database["public"]["Enums"]["cert_asset_type"]
          updated_at?: string
        }
        Update: {
          asset_code?: string
          created_at?: string
          customer_id?: string
          datacenter?: Database["public"]["Enums"]["cert_datacenter"]
          hostname?: string | null
          id?: string
          observacoes?: string | null
          sistema_operacional?: string | null
          status?: Database["public"]["Enums"]["cert_asset_status"] | null
          tipo?: Database["public"]["Enums"]["cert_asset_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cert_assets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "cert_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
          user_level: number | null
          user_name: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
          user_level?: number | null
          user_name?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
          user_level?: number | null
          user_name?: string | null
        }
        Relationships: []
      }
      cert_customer_contacts: {
        Row: {
          cargo: string | null
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean | null
          nome: string
          telefone: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          nome: string
          telefone?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "cert_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_customers: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          segmento: string | null
          tem_suporte: boolean | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          segmento?: string | null
          tem_suporte?: boolean | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          segmento?: string | null
          tem_suporte?: boolean | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cert_proposal_links: {
        Row: {
          created_at: string
          customer_id: string
          descricao: string | null
          id: string
          proposal_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          descricao?: string | null
          id?: string
          proposal_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          descricao?: string | null
          id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cert_proposal_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "cert_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_views: {
        Row: {
          client_email: string | null
          id: string
          ip_address: string | null
          proposal_id: string
          source: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          client_email?: string | null
          id?: string
          ip_address?: string | null
          proposal_id: string
          source?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          client_email?: string | null
          id?: string
          ip_address?: string | null
          proposal_id?: string
          source?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: []
      }
      tech_assets: {
        Row: {
          ambiente: Database["public"]["Enums"]["asset_environment"]
          client_id: string
          cpu: string | null
          created_at: string
          disco_gb: number | null
          id: string
          identificador: string
          ip_principal: string | null
          memoria_gb: number | null
          status: Database["public"]["Enums"]["asset_status"]
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at: string
        }
        Insert: {
          ambiente?: Database["public"]["Enums"]["asset_environment"]
          client_id: string
          cpu?: string | null
          created_at?: string
          disco_gb?: number | null
          id?: string
          identificador: string
          ip_principal?: string | null
          memoria_gb?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Update: {
          ambiente?: Database["public"]["Enums"]["asset_environment"]
          client_id?: string
          cpu?: string | null
          created_at?: string
          disco_gb?: number | null
          id?: string
          identificador?: string
          ip_principal?: string | null
          memoria_gb?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          tipo?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "tech_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_clients: {
        Row: {
          created_at: string
          cs_manager_id: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string
          segmento: string | null
          sla_level: Database["public"]["Enums"]["sla_level"]
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cs_manager_id?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          segmento?: string | null
          sla_level?: Database["public"]["Enums"]["sla_level"]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cs_manager_id?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          segmento?: string | null
          sla_level?: Database["public"]["Enums"]["sla_level"]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_clients_cs_manager_id_fkey"
            columns: ["cs_manager_id"]
            isOneToOne: false
            referencedRelation: "tech_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_credentials: {
        Row: {
          asset_id: string
          created_at: string
          cred_type: Database["public"]["Enums"]["credential_type"]
          id: string
          last_rotated_at: string | null
          secret_ref: string | null
          secret_value: string | null
          updated_at: string
          username: string
          visibility_level: Database["public"]["Enums"]["credential_visibility"]
        }
        Insert: {
          asset_id: string
          created_at?: string
          cred_type: Database["public"]["Enums"]["credential_type"]
          id?: string
          last_rotated_at?: string | null
          secret_ref?: string | null
          secret_value?: string | null
          updated_at?: string
          username: string
          visibility_level?: Database["public"]["Enums"]["credential_visibility"]
        }
        Update: {
          asset_id?: string
          created_at?: string
          cred_type?: Database["public"]["Enums"]["credential_type"]
          id?: string
          last_rotated_at?: string | null
          secret_ref?: string | null
          secret_value?: string | null
          updated_at?: string
          username?: string
          visibility_level?: Database["public"]["Enums"]["credential_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "tech_credentials_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "tech_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_incident_actions: {
        Row: {
          action_text: string
          action_type: string
          created_at: string
          id: string
          incident_id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_text: string
          action_type?: string
          created_at?: string
          id?: string
          incident_id: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_text?: string
          action_type?: string
          created_at?: string
          id?: string
          incident_id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tech_incident_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "tech_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_incident_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tech_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_incident_root_cause: {
        Row: {
          category: Database["public"]["Enums"]["root_cause_category"]
          created_at: string
          details: string
          id: string
          incident_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["root_cause_category"]
          created_at?: string
          details: string
          id?: string
          incident_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["root_cause_category"]
          created_at?: string
          details?: string
          id?: string
          incident_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_incident_root_cause_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "tech_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_incidents: {
        Row: {
          asset_id: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          opened_at: string
          origin_channel: Database["public"]["Enums"]["incident_origin"]
          owner_user_id: string | null
          resolved_at: string | null
          severidade: Database["public"]["Enums"]["incident_severity"]
          sla_level_aplicado: Database["public"]["Enums"]["sla_level"]
          status: Database["public"]["Enums"]["incident_status"]
          tipo: Database["public"]["Enums"]["incident_type"]
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          opened_at?: string
          origin_channel?: Database["public"]["Enums"]["incident_origin"]
          owner_user_id?: string | null
          resolved_at?: string | null
          severidade?: Database["public"]["Enums"]["incident_severity"]
          sla_level_aplicado: Database["public"]["Enums"]["sla_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          tipo: Database["public"]["Enums"]["incident_type"]
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          opened_at?: string
          origin_channel?: Database["public"]["Enums"]["incident_origin"]
          owner_user_id?: string | null
          resolved_at?: string | null
          severidade?: Database["public"]["Enums"]["incident_severity"]
          sla_level_aplicado?: Database["public"]["Enums"]["sla_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          tipo?: Database["public"]["Enums"]["incident_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "tech_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_incidents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "tech_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_incidents_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "tech_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_on_call_shifts: {
        Row: {
          created_at: string
          end_at: string
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["on_call_level"]
          start_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          is_active?: boolean
          level: Database["public"]["Enums"]["on_call_level"]
          start_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["on_call_level"]
          start_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_on_call_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tech_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          role: Database["public"]["Enums"]["tech_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["tech_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["tech_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_tech_admin: { Args: never; Returns: boolean }
      is_tech_team_member: { Args: never; Returns: boolean }
    }
    Enums: {
      asset_environment: "PROD" | "HOMOLOG" | "DEV" | "NAO_INFORMADO"
      asset_status: "ATIVO" | "MANUTENCAO" | "DESLIGADO"
      asset_type: "VM" | "BAREMETAL" | "GPU" | "KUBERNETES" | "STORAGE"
      cert_asset_status: "ATIVO" | "MANUTENCAO" | "DESLIGADO" | "PROVISIONANDO"
      cert_asset_type:
        | "VM"
        | "BAREMETAL"
        | "GPU"
        | "KUBERNETES"
        | "STORAGE"
        | "FIREWALL"
        | "LOAD_BALANCER"
      cert_datacenter:
        | "DC1_SP"
        | "DC2_SP"
        | "DC3_RJ"
        | "CLOUD_AWS"
        | "CLOUD_GCP"
        | "CLOUD_AZURE"
      client_status: "ATIVO" | "SUSPENSO" | "ENCERRADO"
      credential_type: "ROOT" | "ADMIN" | "APP" | "OUTRO"
      credential_visibility: "N2_PLUS" | "N3_PLUS" | "ADMIN_ONLY"
      incident_origin:
        | "PORTAL_CLIENTE"
        | "PORTAL_INTERNO"
        | "EMAIL"
        | "WHATSAPP"
        | "INTERNO"
      incident_severity: "S1" | "S2" | "S3" | "S4"
      incident_status:
        | "ABERTO"
        | "CLASSIFICADO"
        | "EM_ATENDIMENTO"
        | "ESCALADO"
        | "RESOLVIDO"
        | "ENCERRADO"
      incident_type:
        | "QUEDA"
        | "PERFORMANCE"
        | "CONFIGURACAO"
        | "DUVIDA"
        | "MUDANCA"
        | "OUTRO"
      on_call_level: "N1" | "N2" | "N3"
      root_cause_category:
        | "HARDWARE"
        | "CONFIG"
        | "HUMANO"
        | "EXTERNO"
        | "DESCONHECIDO"
      sla_level: "PADRAO" | "PREMIUM" | "CRITICO"
      tech_role: "ADMIN" | "N1" | "N2" | "N3" | "CS"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_environment: ["PROD", "HOMOLOG", "DEV", "NAO_INFORMADO"],
      asset_status: ["ATIVO", "MANUTENCAO", "DESLIGADO"],
      asset_type: ["VM", "BAREMETAL", "GPU", "KUBERNETES", "STORAGE"],
      cert_asset_status: ["ATIVO", "MANUTENCAO", "DESLIGADO", "PROVISIONANDO"],
      cert_asset_type: [
        "VM",
        "BAREMETAL",
        "GPU",
        "KUBERNETES",
        "STORAGE",
        "FIREWALL",
        "LOAD_BALANCER",
      ],
      cert_datacenter: [
        "DC1_SP",
        "DC2_SP",
        "DC3_RJ",
        "CLOUD_AWS",
        "CLOUD_GCP",
        "CLOUD_AZURE",
      ],
      client_status: ["ATIVO", "SUSPENSO", "ENCERRADO"],
      credential_type: ["ROOT", "ADMIN", "APP", "OUTRO"],
      credential_visibility: ["N2_PLUS", "N3_PLUS", "ADMIN_ONLY"],
      incident_origin: [
        "PORTAL_CLIENTE",
        "PORTAL_INTERNO",
        "EMAIL",
        "WHATSAPP",
        "INTERNO",
      ],
      incident_severity: ["S1", "S2", "S3", "S4"],
      incident_status: [
        "ABERTO",
        "CLASSIFICADO",
        "EM_ATENDIMENTO",
        "ESCALADO",
        "RESOLVIDO",
        "ENCERRADO",
      ],
      incident_type: [
        "QUEDA",
        "PERFORMANCE",
        "CONFIGURACAO",
        "DUVIDA",
        "MUDANCA",
        "OUTRO",
      ],
      on_call_level: ["N1", "N2", "N3"],
      root_cause_category: [
        "HARDWARE",
        "CONFIG",
        "HUMANO",
        "EXTERNO",
        "DESCONHECIDO",
      ],
      sla_level: ["PADRAO", "PREMIUM", "CRITICO"],
      tech_role: ["ADMIN", "N1", "N2", "N3", "CS"],
    },
  },
} as const
