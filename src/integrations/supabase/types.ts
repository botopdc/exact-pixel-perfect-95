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
      academy_enrollments: {
        Row: {
          academy_level: number
          approved_at: string | null
          approved_by: string | null
          course_area: string | null
          created_at: string
          discount_pct: number
          email: string
          full_name: string
          id: string
          institution_name: string | null
          institution_type: string | null
          last_renewed_at: string | null
          notes: string | null
          proof_file_id: string | null
          proof_url: string | null
          status: Database["public"]["Enums"]["academy_enrollment_status"]
          updated_at: string
          user_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          academy_level: number
          approved_at?: string | null
          approved_by?: string | null
          course_area?: string | null
          created_at?: string
          discount_pct?: number
          email: string
          full_name: string
          id?: string
          institution_name?: string | null
          institution_type?: string | null
          last_renewed_at?: string | null
          notes?: string | null
          proof_file_id?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["academy_enrollment_status"]
          updated_at?: string
          user_id: string
          valid_from?: string
          valid_until?: string
        }
        Update: {
          academy_level?: number
          approved_at?: string | null
          approved_by?: string | null
          course_area?: string | null
          created_at?: string
          discount_pct?: number
          email?: string
          full_name?: string
          id?: string
          institution_name?: string | null
          institution_type?: string | null
          last_renewed_at?: string | null
          notes?: string | null
          proof_file_id?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["academy_enrollment_status"]
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
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
      calculator_configs: {
        Row: {
          category: string
          config: Json
          created_at: string
          deleted_at: string | null
          id: number
          section: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: number
          section: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: number
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      calculator_proposal_addons: {
        Row: {
          addon_key: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          label: string
          metadata: Json | null
          proposal_id: string
          quantity: number
          sort_order: number
          total_price: number
          unit_price: number
        }
        Insert: {
          addon_key: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label: string
          metadata?: Json | null
          proposal_id: string
          quantity?: number
          sort_order?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          addon_key?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label?: string
          metadata?: Json | null
          proposal_id?: string
          quantity?: number
          sort_order?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculator_proposal_addons_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "calculator_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_proposal_files: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          file_type: string
          id: string
          proposal_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          file_type?: string
          id?: string
          proposal_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          file_type?: string
          id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculator_proposal_files_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "calculator_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_proposal_servers: {
        Row: {
          bm_cpu: string | null
          bm_ram: string | null
          created_at: string
          created_by: string | null
          disks: Json | null
          gpu: string | null
          gpu_qty: number
          id: string
          ips: number
          name: string
          nvme_tb: number
          proposal_id: string
          qty_servers: number
          ram_gb: number
          server_type: string
          sort_order: number
          specs: Json | null
          storage_region: string | null
          storage_type: string | null
          total_price: number
          traffic_tb: number
          unit_price: number
          vcpu: number
          volume_tb: number | null
        }
        Insert: {
          bm_cpu?: string | null
          bm_ram?: string | null
          created_at?: string
          created_by?: string | null
          disks?: Json | null
          gpu?: string | null
          gpu_qty?: number
          id?: string
          ips?: number
          name?: string
          nvme_tb?: number
          proposal_id: string
          qty_servers?: number
          ram_gb?: number
          server_type?: string
          sort_order?: number
          specs?: Json | null
          storage_region?: string | null
          storage_type?: string | null
          total_price?: number
          traffic_tb?: number
          unit_price?: number
          vcpu?: number
          volume_tb?: number | null
        }
        Update: {
          bm_cpu?: string | null
          bm_ram?: string | null
          created_at?: string
          created_by?: string | null
          disks?: Json | null
          gpu?: string | null
          gpu_qty?: number
          id?: string
          ips?: number
          name?: string
          nvme_tb?: number
          proposal_id?: string
          qty_servers?: number
          ram_gb?: number
          server_type?: string
          sort_order?: number
          specs?: Json | null
          storage_region?: string | null
          storage_type?: string | null
          total_price?: number
          traffic_tb?: number
          unit_price?: number
          vcpu?: number
          volume_tb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calculator_proposal_servers_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "calculator_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      calculator_proposals: {
        Row: {
          approval_decision: string | null
          approval_notes: string | null
          approval_token: string | null
          approval_token_expires_at: string | null
          approved_at: string | null
          approved_by_email: string | null
          approved_by_name: string | null
          channel_type: string
          commission_reason: string | null
          commission_value: number | null
          company: string
          contract_duration: number
          created_at: string
          created_by: string | null
          currency: string
          datacenter: string
          discount_pct: number
          display_id: string | null
          due_at: string
          email: string
          external_id: number | null
          fx: number
          id: string
          name: string
          observations: string | null
          pdf_generated_at: string | null
          pdf_path: string | null
          phone: string
          public_approval_enabled: boolean
          public_approval_expires_at: string | null
          public_approval_token: string | null
          rejected_at: string | null
          reseller_name: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          approval_decision?: string | null
          approval_notes?: string | null
          approval_token?: string | null
          approval_token_expires_at?: string | null
          approved_at?: string | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          channel_type?: string
          commission_reason?: string | null
          commission_value?: number | null
          company: string
          contract_duration?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          datacenter?: string
          discount_pct?: number
          display_id?: string | null
          due_at?: string
          email: string
          external_id?: number | null
          fx?: number
          id?: string
          name: string
          observations?: string | null
          pdf_generated_at?: string | null
          pdf_path?: string | null
          phone: string
          public_approval_enabled?: boolean
          public_approval_expires_at?: string | null
          public_approval_token?: string | null
          rejected_at?: string | null
          reseller_name?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          approval_decision?: string | null
          approval_notes?: string | null
          approval_token?: string | null
          approval_token_expires_at?: string | null
          approved_at?: string | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          channel_type?: string
          commission_reason?: string | null
          commission_value?: number | null
          company?: string
          contract_duration?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          datacenter?: string
          discount_pct?: number
          display_id?: string | null
          due_at?: string
          email?: string
          external_id?: number | null
          fx?: number
          id?: string
          name?: string
          observations?: string | null
          pdf_generated_at?: string | null
          pdf_path?: string | null
          phone?: string
          public_approval_enabled?: boolean
          public_approval_expires_at?: string | null
          public_approval_token?: string | null
          rejected_at?: string | null
          reseller_name?: string | null
          status?: string
          total?: number
          updated_at?: string
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
          asset_id: string | null
          created_at: string
          customer_id: string
          descricao: string | null
          id: string
          imported_at: string | null
          is_active: boolean | null
          proposal_company: string | null
          proposal_id: string
          proposal_status: string | null
          proposal_term_months: number | null
          proposal_total: number | null
          proposal_uuid: string | null
          snapshot_json: Json | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          customer_id: string
          descricao?: string | null
          id?: string
          imported_at?: string | null
          is_active?: boolean | null
          proposal_company?: string | null
          proposal_id: string
          proposal_status?: string | null
          proposal_term_months?: number | null
          proposal_total?: number | null
          proposal_uuid?: string | null
          snapshot_json?: Json | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          customer_id?: string
          descricao?: string | null
          id?: string
          imported_at?: string | null
          is_active?: boolean | null
          proposal_company?: string | null
          proposal_id?: string
          proposal_status?: string | null
          proposal_term_months?: number | null
          proposal_total?: number | null
          proposal_uuid?: string | null
          snapshot_json?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_proposal_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "cert_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cert_proposal_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "cert_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_test: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          source: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          source: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          source?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          bucket: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          path: string
          updated_at: string | null
          version: number
        }
        Insert: {
          bucket: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          path: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          bucket?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          path?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      contracts: {
        Row: {
          annex_pdf_path: string | null
          billing_cycle: string
          city: string | null
          client_name: string
          cnpj: string | null
          company: string
          company_name: string | null
          contract_city: string | null
          contract_date: string | null
          contract_duration: number | null
          contract_number: string | null
          contract_payload: Json | null
          contract_pdf_path: string | null
          created_at: string
          currency: string
          datacenter: string | null
          deleted_at: string | null
          discount_amount: number | null
          docx_path: string | null
          due_at: string | null
          email: string
          end_date: string | null
          final_pdf_path: string | null
          generated_by: string | null
          generated_from_proposal_at: string
          generation_strategy: string | null
          has_no_cnpj: boolean
          id: string
          legal_name: string | null
          metadata: Json | null
          neighborhood: string | null
          notes: string | null
          open_signer_cpf: string | null
          open_signer_name: string | null
          payment_day: number | null
          phone: string
          proposal_id: string
          proposal_payload: Json
          proposal_pdf_source_path: string | null
          proposal_uuid: string | null
          responsible_cpf: string | null
          responsible_name: string | null
          setup_value: number
          start_date: string | null
          state: string | null
          status: string
          street: string | null
          subtotal: number | null
          tax_id: string | null
          template_code: string | null
          template_path: string | null
          total: number | null
          updated_at: string
          updated_by: string | null
          witness_1_cpf: string | null
          witness_1_name: string | null
          witness_2_cpf: string | null
          witness_2_name: string | null
          zip_code: string | null
        }
        Insert: {
          annex_pdf_path?: string | null
          billing_cycle?: string
          city?: string | null
          client_name: string
          cnpj?: string | null
          company: string
          company_name?: string | null
          contract_city?: string | null
          contract_date?: string | null
          contract_duration?: number | null
          contract_number?: string | null
          contract_payload?: Json | null
          contract_pdf_path?: string | null
          created_at?: string
          currency?: string
          datacenter?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          docx_path?: string | null
          due_at?: string | null
          email: string
          end_date?: string | null
          final_pdf_path?: string | null
          generated_by?: string | null
          generated_from_proposal_at?: string
          generation_strategy?: string | null
          has_no_cnpj?: boolean
          id?: string
          legal_name?: string | null
          metadata?: Json | null
          neighborhood?: string | null
          notes?: string | null
          open_signer_cpf?: string | null
          open_signer_name?: string | null
          payment_day?: number | null
          phone?: string
          proposal_id: string
          proposal_payload?: Json
          proposal_pdf_source_path?: string | null
          proposal_uuid?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          setup_value?: number
          start_date?: string | null
          state?: string | null
          status?: string
          street?: string | null
          subtotal?: number | null
          tax_id?: string | null
          template_code?: string | null
          template_path?: string | null
          total?: number | null
          updated_at?: string
          updated_by?: string | null
          witness_1_cpf?: string | null
          witness_1_name?: string | null
          witness_2_cpf?: string | null
          witness_2_name?: string | null
          zip_code?: string | null
        }
        Update: {
          annex_pdf_path?: string | null
          billing_cycle?: string
          city?: string | null
          client_name?: string
          cnpj?: string | null
          company?: string
          company_name?: string | null
          contract_city?: string | null
          contract_date?: string | null
          contract_duration?: number | null
          contract_number?: string | null
          contract_payload?: Json | null
          contract_pdf_path?: string | null
          created_at?: string
          currency?: string
          datacenter?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          docx_path?: string | null
          due_at?: string | null
          email?: string
          end_date?: string | null
          final_pdf_path?: string | null
          generated_by?: string | null
          generated_from_proposal_at?: string
          generation_strategy?: string | null
          has_no_cnpj?: boolean
          id?: string
          legal_name?: string | null
          metadata?: Json | null
          neighborhood?: string | null
          notes?: string | null
          open_signer_cpf?: string | null
          open_signer_name?: string | null
          payment_day?: number | null
          phone?: string
          proposal_id?: string
          proposal_payload?: Json
          proposal_pdf_source_path?: string | null
          proposal_uuid?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          setup_value?: number
          start_date?: string | null
          state?: string | null
          status?: string
          street?: string | null
          subtotal?: number | null
          tax_id?: string | null
          template_code?: string | null
          template_path?: string | null
          total?: number | null
          updated_at?: string
          updated_by?: string | null
          witness_1_cpf?: string | null
          witness_1_name?: string | null
          witness_2_cpf?: string | null
          witness_2_name?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "calculator_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      docs_sync_coverage: {
        Row: {
          doc_slug: string
          id: string
          is_covered: boolean | null
          notes: string | null
          source_name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          doc_slug: string
          id?: string
          is_covered?: boolean | null
          notes?: string | null
          source_name: string
          source_type: string
          updated_at?: string
        }
        Update: {
          doc_slug?: string
          id?: string
          is_covered?: boolean | null
          notes?: string | null
          source_name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      docs_sync_runs: {
        Row: {
          command_name: string
          created_at: string
          details_md: string | null
          files_affected: string[] | null
          finished_at: string | null
          id: string
          started_at: string | null
          status: string
          summary: string | null
          triggered_by: string | null
        }
        Insert: {
          command_name: string
          created_at?: string
          details_md?: string | null
          files_affected?: string[] | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          summary?: string | null
          triggered_by?: string | null
        }
        Update: {
          command_name?: string
          created_at?: string
          details_md?: string | null
          files_affected?: string[] | null
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          summary?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      ops_service_status: {
        Row: {
          created_at: string
          id: string
          service_code: string
          service_name: string
          source: string
          status: string
          status_message: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          service_code: string
          service_name: string
          source?: string
          status?: string
          status_message?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          service_code?: string
          service_name?: string
          source?: string
          status?: string
          status_message?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: number | null
          created_at: string
          department: string | null
          email: string
          entity_id: number | null
          full_name: string | null
          id: string
          is_active: boolean
          legacy_user_id: number | null
          level: number
          level_legacy: number | null
          name: string
          role_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: number | null
          created_at?: string
          department?: string | null
          email: string
          entity_id?: number | null
          full_name?: string | null
          id: string
          is_active?: boolean
          legacy_user_id?: number | null
          level?: number
          level_legacy?: number | null
          name: string
          role_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: number | null
          created_at?: string
          department?: string | null
          email?: string
          entity_id?: number | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          legacy_user_id?: number | null
          level?: number
          level_legacy?: number | null
          name?: string
          role_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_participants: {
        Row: {
          commission_pct: number | null
          created_at: string
          external_user_id: number
          id: string
          proposal_id: string
          role: Database["public"]["Enums"]["participant_role"]
          updated_at: string
        }
        Insert: {
          commission_pct?: number | null
          created_at?: string
          external_user_id: number
          id?: string
          proposal_id: string
          role: Database["public"]["Enums"]["participant_role"]
          updated_at?: string
        }
        Update: {
          commission_pct?: number | null
          created_at?: string
          external_user_id?: number
          id?: string
          proposal_id?: string
          role?: Database["public"]["Enums"]["participant_role"]
          updated_at?: string
        }
        Relationships: []
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
      rbac_apps: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      rbac_permissions: {
        Row: {
          action_code: string
          active: boolean
          app_id: string
          created_at: string
          description: string | null
          id: string
          module_code: string
          permission_key: string
        }
        Insert: {
          action_code: string
          active?: boolean
          app_id: string
          created_at?: string
          description?: string | null
          id?: string
          module_code: string
          permission_key: string
        }
        Update: {
          action_code?: string
          active?: boolean
          app_id?: string
          created_at?: string
          description?: string | null
          id?: string
          module_code?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_permissions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "rbac_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "rbac_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_roles: {
        Row: {
          active: boolean
          app_id: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          app_id: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          app_id?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_roles_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "rbac_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_team_members: {
        Row: {
          active: boolean
          id: string
          joined_at: string
          left_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          joined_at?: string
          left_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          id?: string
          joined_at?: string
          left_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rbac_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_teams: {
        Row: {
          active: boolean
          app_id: string
          code: string
          created_at: string
          id: string
          manager_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          app_id: string
          code: string
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          app_id?: string
          code?: string
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_teams_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "rbac_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_user_roles: {
        Row: {
          active: boolean
          app_id: string
          assigned_by_user_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          role_id: string
          starts_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          app_id: string
          assigned_by_user_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          role_id: string
          starts_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          app_id?: string
          assigned_by_user_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          role_id?: string
          starts_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_roles_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "rbac_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_user_scopes: {
        Row: {
          active: boolean
          app_id: string
          assigned_by_user_id: string | null
          created_at: string
          id: string
          portfolio_code: string | null
          region_code: string | null
          scope_type: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          app_id: string
          assigned_by_user_id?: string | null
          created_at?: string
          id?: string
          portfolio_code?: string | null
          region_code?: string | null
          scope_type: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          app_id?: string
          assigned_by_user_id?: string | null
          created_at?: string
          id?: string
          portfolio_code?: string | null
          region_code?: string | null
          scope_type?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_scopes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "rbac_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rbac_user_scopes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rbac_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_value: Json | null
          previous_value: Json | null
          role_code: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          role_code?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          role_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      sales_accounts: {
        Row: {
          account_status: string
          address_line: string | null
          archived_at: string | null
          assigned_team_id: string | null
          city: string | null
          cnpj: string | null
          company_size: string | null
          country: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          estimated_potential_mrr: number | null
          external_company_id: string | null
          id: string
          legal_name: string
          owner_team_id: string | null
          owner_user_id: string
          segment_id: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          account_status?: string
          address_line?: string | null
          archived_at?: string | null
          assigned_team_id?: string | null
          city?: string | null
          cnpj?: string | null
          company_size?: string | null
          country?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          estimated_potential_mrr?: number | null
          external_company_id?: string | null
          id?: string
          legal_name: string
          owner_team_id?: string | null
          owner_user_id: string
          segment_id?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          account_status?: string
          address_line?: string | null
          archived_at?: string | null
          assigned_team_id?: string | null
          city?: string | null
          cnpj?: string | null
          company_size?: string | null
          country?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          estimated_potential_mrr?: number | null
          external_company_id?: string | null
          id?: string
          legal_name?: string
          owner_team_id?: string | null
          owner_user_id?: string
          segment_id?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_accounts_segment_id"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "sales_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_accounts_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "rbac_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_accounts_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "rbac_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_activities: {
        Row: {
          account_id: string
          activity_type: string
          archived_at: string | null
          assigned_user_id: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          due_at: string
          id: string
          next_action: string | null
          opportunity_id: string
          outcome: string | null
          priority: string
          related_meeting_url: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          account_id: string
          activity_type: string
          archived_at?: string | null
          assigned_user_id: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          due_at: string
          id?: string
          next_action?: string | null
          opportunity_id: string
          outcome?: string | null
          priority?: string
          related_meeting_url?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          activity_type?: string
          archived_at?: string | null
          assigned_user_id?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          due_at?: string
          id?: string
          next_action?: string | null
          opportunity_id?: string
          outcome?: string | null
          priority?: string
          related_meeting_url?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "sales_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_audit_log: {
        Row: {
          action: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          performed_at: string
          performed_by_user_id: string
        }
        Insert: {
          action: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by_user_id: string
        }
        Update: {
          action?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by_user_id?: string
        }
        Relationships: []
      }
      sales_contacts: {
        Row: {
          account_id: string
          archived_at: string | null
          created_at: string
          created_by_user_id: string
          department: string | null
          email: string | null
          id: string
          influence_level: string | null
          is_primary: boolean
          job_title: string | null
          linkedin_url: string | null
          name: string
          owner_user_id: string | null
          phone: string | null
          relationship_status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          account_id: string
          archived_at?: string | null
          created_at?: string
          created_by_user_id: string
          department?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          is_primary?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          name: string
          owner_user_id?: string | null
          phone?: string | null
          relationship_status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          account_id?: string
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string
          department?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          is_primary?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          name?: string
          owner_user_id?: string | null
          phone?: string | null
          relationship_status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "sales_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_entity_tags: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "sales_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lead_sources: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales_leads: {
        Row: {
          account_id: string | null
          archived_at: string | null
          company_name: string
          contact_id: string | null
          contact_name: string | null
          converted_at: string | null
          converted_to_opportunity_id: string | null
          created_at: string
          created_by_user_id: string
          email: string | null
          id: string
          lead_source_id: string | null
          lost_reason: string | null
          owner_team_id: string | null
          owner_user_id: string
          phone: string | null
          qualification_notes: string | null
          sdr_user_id: string | null
          segment_id: string | null
          status: string
          temperature: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          company_name: string
          contact_id?: string | null
          contact_name?: string | null
          converted_at?: string | null
          converted_to_opportunity_id?: string | null
          created_at?: string
          created_by_user_id: string
          email?: string | null
          id?: string
          lead_source_id?: string | null
          lost_reason?: string | null
          owner_team_id?: string | null
          owner_user_id: string
          phone?: string | null
          qualification_notes?: string | null
          sdr_user_id?: string | null
          segment_id?: string | null
          status?: string
          temperature?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          company_name?: string
          contact_id?: string | null
          contact_name?: string | null
          converted_at?: string | null
          converted_to_opportunity_id?: string | null
          created_at?: string
          created_by_user_id?: string
          email?: string | null
          id?: string
          lead_source_id?: string | null
          lost_reason?: string | null
          owner_team_id?: string | null
          owner_user_id?: string
          phone?: string | null
          qualification_notes?: string | null
          sdr_user_id?: string | null
          segment_id?: string | null
          status?: string
          temperature?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_leads_converted_to_opportunity_id"
            columns: ["converted_to_opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_leads_lead_source_id"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "sales_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_leads_segment_id"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "sales_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "sales_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "rbac_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_loss_reasons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales_notes: {
        Row: {
          created_at: string
          created_by_user_id: string
          entity_id: string
          entity_type: string
          id: string
          note_text: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          entity_id: string
          entity_type: string
          id?: string
          note_text: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          note_text?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      sales_opportunities: {
        Row: {
          account_id: string
          archived_at: string | null
          closed_lost_at: string | null
          closed_won_at: string | null
          competitor_name: string | null
          created_at: string
          created_by_user_id: string
          estimated_mrr: number | null
          estimated_setup: number | null
          estimated_tcv: number | null
          expected_close_date: string | null
          has_open_activity: boolean
          id: string
          last_activity_at: string | null
          lead_id: string | null
          lead_source_id: string | null
          loss_notes: string | null
          loss_reason_id: string | null
          next_activity_at: string | null
          on_hold_at: string | null
          owner_team_id: string | null
          owner_user_id: string
          pipeline_status: string
          pre_sales_user_id: string | null
          primary_contact_id: string | null
          probability: number | null
          sdr_user_id: string | null
          segment_id: string | null
          solution_type: string | null
          stage_id: string
          strategic_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          archived_at?: string | null
          closed_lost_at?: string | null
          closed_won_at?: string | null
          competitor_name?: string | null
          created_at?: string
          created_by_user_id: string
          estimated_mrr?: number | null
          estimated_setup?: number | null
          estimated_tcv?: number | null
          expected_close_date?: string | null
          has_open_activity?: boolean
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          lead_source_id?: string | null
          loss_notes?: string | null
          loss_reason_id?: string | null
          next_activity_at?: string | null
          on_hold_at?: string | null
          owner_team_id?: string | null
          owner_user_id: string
          pipeline_status?: string
          pre_sales_user_id?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          sdr_user_id?: string | null
          segment_id?: string | null
          solution_type?: string | null
          stage_id: string
          strategic_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          archived_at?: string | null
          closed_lost_at?: string | null
          closed_won_at?: string | null
          competitor_name?: string | null
          created_at?: string
          created_by_user_id?: string
          estimated_mrr?: number | null
          estimated_setup?: number | null
          estimated_tcv?: number | null
          expected_close_date?: string | null
          has_open_activity?: boolean
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          lead_source_id?: string | null
          loss_notes?: string | null
          loss_reason_id?: string | null
          next_activity_at?: string | null
          on_hold_at?: string | null
          owner_team_id?: string | null
          owner_user_id?: string
          pipeline_status?: string
          pre_sales_user_id?: string | null
          primary_contact_id?: string | null
          probability?: number | null
          sdr_user_id?: string | null
          segment_id?: string | null
          solution_type?: string | null
          stage_id?: string
          strategic_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "sales_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "sales_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "sales_loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "rbac_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "sales_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_opportunity_products: {
        Row: {
          contract_term_months: number | null
          created_at: string
          id: string
          opportunity_id: string
          product_name: string
          product_reference_id: string | null
          product_type: string
          quantity: number
          setup_value: number | null
          unit_monthly_value: number | null
          updated_at: string
        }
        Insert: {
          contract_term_months?: number | null
          created_at?: string
          id?: string
          opportunity_id: string
          product_name: string
          product_reference_id?: string | null
          product_type: string
          quantity?: number
          setup_value?: number | null
          unit_monthly_value?: number | null
          updated_at?: string
        }
        Update: {
          contract_term_months?: number | null
          created_at?: string
          id?: string
          opportunity_id?: string
          product_name?: string
          product_reference_id?: string | null
          product_type?: string
          quantity?: number
          setup_value?: number | null
          unit_monthly_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunity_products_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_opportunity_stage_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by_user_id: string
          from_stage_id: string | null
          id: string
          opportunity_id: string
          to_stage_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by_user_id: string
          from_stage_id?: string | null
          id?: string
          opportunity_id: string
          to_stage_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by_user_id?: string
          from_stage_id?: string | null
          id?: string
          opportunity_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunity_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunity_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pipeline_stages: {
        Row: {
          active: boolean
          code: string
          created_at: string
          default_probability: number | null
          id: string
          is_lost_stage: boolean
          is_on_hold_stage: boolean
          is_open_stage: boolean
          is_won_stage: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          default_probability?: number | null
          id?: string
          is_lost_stage?: boolean
          is_on_hold_stage?: boolean
          is_open_stage?: boolean
          is_won_stage?: boolean
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          default_probability?: number | null
          id?: string
          is_lost_stage?: boolean
          is_on_hold_stage?: boolean
          is_open_stage?: boolean
          is_won_stage?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales_proposals_links: {
        Row: {
          approved_at: string | null
          contract_term_months: number | null
          created_at: string
          created_by_user_id: string
          expires_at: string | null
          external_proposal_id: string
          id: string
          monthly_value: number | null
          opportunity_id: string
          proposal_number: string | null
          public_link_token: string | null
          rejected_at: string | null
          sent_at: string | null
          setup_value: number | null
          status: string
          tcv: number | null
          updated_at: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          contract_term_months?: number | null
          created_at?: string
          created_by_user_id: string
          expires_at?: string | null
          external_proposal_id: string
          id?: string
          monthly_value?: number | null
          opportunity_id: string
          proposal_number?: string | null
          public_link_token?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          setup_value?: number | null
          status?: string
          tcv?: number | null
          updated_at?: string
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          contract_term_months?: number | null
          created_at?: string
          created_by_user_id?: string
          expires_at?: string | null
          external_proposal_id?: string
          id?: string
          monthly_value?: number | null
          opportunity_id?: string
          proposal_number?: string | null
          public_link_token?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          setup_value?: number | null
          status?: string
          tcv?: number | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_proposals_links_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_segments: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales_tags: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          name: string
          scope: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name: string
          scope?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          scope?: string
        }
        Relationships: []
      }
      support_catalog_categories: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      support_catalog_services: {
        Row: {
          category_code: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category_code?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category_code?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      support_notifications: {
        Row: {
          body: string | null
          created_at: string
          event_name: string
          id: string
          is_read: boolean
          metadata: Json
          ticket_id: string | null
          ticket_public_code: string | null
          title: string
          user_id: string
          user_level: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_name: string
          id?: string
          is_read?: boolean
          metadata?: Json
          ticket_id?: string | null
          ticket_public_code?: string | null
          title: string
          user_id: string
          user_level?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string
          event_name?: string
          id?: string
          is_read?: boolean
          metadata?: Json
          ticket_id?: string | null
          ticket_public_code?: string | null
          title?: string
          user_id?: string
          user_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "support_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_oncall: {
        Row: {
          created_at: string
          end_at: string | null
          id: string
          is_active: boolean
          start_at: string
          team: string
          user_email: string
          user_id: number
          user_name: string
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          id?: string
          is_active?: boolean
          start_at?: string
          team: string
          user_email: string
          user_id: number
          user_name: string
        }
        Update: {
          created_at?: string
          end_at?: string | null
          id?: string
          is_active?: boolean
          start_at?: string
          team?: string
          user_email?: string
          user_id?: number
          user_name?: string
        }
        Relationships: []
      }
      support_oncall_shifts: {
        Row: {
          created_at: string
          created_by: number | null
          ends_at: string
          id: string
          is_active: boolean
          notes: string | null
          starts_at: string
          team_code: string
          team_name: string
          updated_at: string
          user_email: string | null
          user_id: number | null
          user_id_uuid: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          ends_at: string
          id?: string
          is_active?: boolean
          notes?: string | null
          starts_at: string
          team_code: string
          team_name: string
          updated_at?: string
          user_email?: string | null
          user_id?: number | null
          user_id_uuid?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          created_by?: number | null
          ends_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          starts_at?: string
          team_code?: string
          team_name?: string
          updated_at?: string
          user_email?: string | null
          user_id?: number | null
          user_id_uuid?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_oncall_shifts_user_id_uuid_fkey"
            columns: ["user_id_uuid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_queue_members: {
        Row: {
          can_receive_auto_assign: boolean
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          queue_id: string
          updated_at: string
          user_email: string
          user_id: number
          user_id_uuid: string | null
          user_level: number
          user_name: string
        }
        Insert: {
          can_receive_auto_assign?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          queue_id: string
          updated_at?: string
          user_email: string
          user_id: number
          user_id_uuid?: string | null
          user_level: number
          user_name: string
        }
        Update: {
          can_receive_auto_assign?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          queue_id?: string
          updated_at?: string
          user_email?: string
          user_id?: number
          user_id_uuid?: string | null
          user_level?: number
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_queue_members_user_id_uuid_fkey"
            columns: ["user_id_uuid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_queues: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          queue_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          queue_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          queue_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_sla_policies: {
        Row: {
          business_hours_only: boolean
          category: string | null
          code: string
          created_at: string
          customer_plan: string | null
          first_response_minutes: number
          id: string
          is_active: boolean
          metadata: Json
          name: string
          pause_on_waiting_customer: boolean
          pause_on_waiting_third_party: boolean
          resolution_minutes: number
          severity: string | null
          sort_order: number
          ticket_type: string | null
          updated_at: string
        }
        Insert: {
          business_hours_only?: boolean
          category?: string | null
          code: string
          created_at?: string
          customer_plan?: string | null
          first_response_minutes: number
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          pause_on_waiting_customer?: boolean
          pause_on_waiting_third_party?: boolean
          resolution_minutes: number
          severity?: string | null
          sort_order?: number
          ticket_type?: string | null
          updated_at?: string
        }
        Update: {
          business_hours_only?: boolean
          category?: string | null
          code?: string
          created_at?: string
          customer_plan?: string | null
          first_response_minutes?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          pause_on_waiting_customer?: boolean
          pause_on_waiting_third_party?: boolean
          resolution_minutes?: number
          severity?: string | null
          sort_order?: number
          ticket_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_assignments: {
        Row: {
          assigned_by_name: string | null
          assigned_by_user_id: string | null
          created_at: string
          from_queue: string | null
          from_support_level: string | null
          from_user_id: string | null
          from_user_name: string | null
          id: string
          reason: string | null
          ticket_id: string
          to_queue: string | null
          to_support_level: string | null
          to_user_id: string | null
          to_user_name: string | null
        }
        Insert: {
          assigned_by_name?: string | null
          assigned_by_user_id?: string | null
          created_at?: string
          from_queue?: string | null
          from_support_level?: string | null
          from_user_id?: string | null
          from_user_name?: string | null
          id?: string
          reason?: string | null
          ticket_id: string
          to_queue?: string | null
          to_support_level?: string | null
          to_user_id?: string | null
          to_user_name?: string | null
        }
        Update: {
          assigned_by_name?: string | null
          assigned_by_user_id?: string | null
          created_at?: string
          from_queue?: string | null
          from_support_level?: string | null
          from_user_id?: string | null
          from_user_name?: string | null
          id?: string
          reason?: string | null
          ticket_id?: string
          to_queue?: string | null
          to_support_level?: string | null
          to_user_id?: string | null
          to_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_attachments: {
        Row: {
          bucket_name: string
          created_at: string
          file_size: number | null
          id: string
          is_internal: boolean
          message_id: string | null
          mime_type: string | null
          original_filename: string
          storage_path: string
          ticket_id: string
          uploaded_by_name: string | null
          uploaded_by_user_id: string | null
        }
        Insert: {
          bucket_name?: string
          created_at?: string
          file_size?: number | null
          id?: string
          is_internal?: boolean
          message_id?: string | null
          mime_type?: string | null
          original_filename: string
          storage_path: string
          ticket_id: string
          uploaded_by_name?: string | null
          uploaded_by_user_id?: string | null
        }
        Update: {
          bucket_name?: string
          created_at?: string
          file_size?: number | null
          id?: string
          is_internal?: boolean
          message_id?: string | null
          mime_type?: string | null
          original_filename?: string
          storage_path?: string
          ticket_id?: string
          uploaded_by_name?: string | null
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_categories: {
        Row: {
          code: string
          created_at: string
          default_queue_id: string | null
          id: string
          is_active: boolean
          name: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_queue_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_queue_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_categories_default_queue_id_fkey"
            columns: ["default_queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_categories_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_name: string
          id: string
          ip_address: string | null
          metadata: Json
          occurred_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          entity_id: string
          entity_type?: string
          event_name: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          occurred_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_name?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          occurred_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          author_email: string | null
          author_level: number | null
          author_name: string
          author_type: Database["public"]["Enums"]["support_author_type"]
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          metadata: Json
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_email?: string | null
          author_level?: number | null
          author_name: string
          author_type?: Database["public"]["Enums"]["support_author_type"]
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          metadata?: Json
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_email?: string | null
          author_level?: number | null
          author_name?: string
          author_type?: Database["public"]["Enums"]["support_author_type"]
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          metadata?: Json
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_queue_history: {
        Row: {
          changed_by_name: string | null
          changed_by_user_id: number | null
          created_at: string
          from_queue_id: string | null
          from_support_level: string | null
          id: string
          reason: string | null
          ticket_id: string
          to_queue_id: string
          to_support_level: string
        }
        Insert: {
          changed_by_name?: string | null
          changed_by_user_id?: number | null
          created_at?: string
          from_queue_id?: string | null
          from_support_level?: string | null
          id?: string
          reason?: string | null
          ticket_id: string
          to_queue_id: string
          to_support_level: string
        }
        Update: {
          changed_by_name?: string | null
          changed_by_user_id?: number | null
          created_at?: string
          from_queue_id?: string | null
          from_support_level?: string | null
          id?: string
          reason?: string | null
          ticket_id?: string
          to_queue_id?: string
          to_support_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_queue_history_from_queue_id_fkey"
            columns: ["from_queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_queue_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_queue_history_to_queue_id_fkey"
            columns: ["to_queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_status_history: {
        Row: {
          changed_by_name: string | null
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
          ticket_id: string
        }
        Insert: {
          changed_by_name?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
          ticket_id: string
        }
        Update: {
          changed_by_name?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_types: {
        Row: {
          code: string
          created_at: string
          default_priority: string | null
          default_queue_id: string | null
          default_severity: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_priority?: string | null
          default_queue_id?: string | null
          default_severity?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_priority?: string | null
          default_queue_id?: string | null
          default_severity?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_types_default_queue_id_fkey"
            columns: ["default_queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_watchers: {
        Row: {
          created_at: string
          id: string
          ticket_id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_watchers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          asset_id: string | null
          asset_label: string | null
          assigned_at: string | null
          assigned_team: string | null
          assigned_to_name: string | null
          assigned_to_user_id: string | null
          category: string
          category_id: string | null
          close_reason: string | null
          closed_at: string | null
          closed_by_user_id: number | null
          company_id: string | null
          created_at: string
          cs_closed_by: string | null
          current_queue: Database["public"]["Enums"]["support_queue_enum"]
          current_queue_id: string | null
          current_support_level: string
          customer_visible: boolean
          deleted_at: string | null
          description: string
          external_reference: string | null
          first_response_at: string | null
          first_response_due_at: string | null
          id: string
          last_customer_message_at: string | null
          last_internal_update_at: string | null
          metadata: Json
          origin_channel: Database["public"]["Enums"]["support_origin_channel"]
          priority: Database["public"]["Enums"]["support_priority"]
          public_code: string | null
          requester_email: string | null
          requester_level: number | null
          requester_name: string
          requester_phone: string | null
          requester_user_id: string | null
          resolution_due_at: string | null
          resolution_summary: string | null
          resolved_at: string | null
          resolved_by_user_id: number | null
          service_name: string | null
          severity: Database["public"]["Enums"]["support_severity"]
          sla_policy_id: string | null
          source_system: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subcategory: string | null
          support_level: Database["public"]["Enums"]["support_level_enum"]
          support_resolved_by: string | null
          ticket_number: number | null
          ticket_type: string
          title: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          asset_label?: string | null
          assigned_at?: string | null
          assigned_team?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          category: string
          category_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by_user_id?: number | null
          company_id?: string | null
          created_at?: string
          cs_closed_by?: string | null
          current_queue?: Database["public"]["Enums"]["support_queue_enum"]
          current_queue_id?: string | null
          current_support_level?: string
          customer_visible?: boolean
          deleted_at?: string | null
          description: string
          external_reference?: string | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_internal_update_at?: string | null
          metadata?: Json
          origin_channel?: Database["public"]["Enums"]["support_origin_channel"]
          priority?: Database["public"]["Enums"]["support_priority"]
          public_code?: string | null
          requester_email?: string | null
          requester_level?: number | null
          requester_name: string
          requester_phone?: string | null
          requester_user_id?: string | null
          resolution_due_at?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: number | null
          service_name?: string | null
          severity?: Database["public"]["Enums"]["support_severity"]
          sla_policy_id?: string | null
          source_system?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subcategory?: string | null
          support_level?: Database["public"]["Enums"]["support_level_enum"]
          support_resolved_by?: string | null
          ticket_number?: number | null
          ticket_type: string
          title: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          asset_label?: string | null
          assigned_at?: string | null
          assigned_team?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          category?: string
          category_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          closed_by_user_id?: number | null
          company_id?: string | null
          created_at?: string
          cs_closed_by?: string | null
          current_queue?: Database["public"]["Enums"]["support_queue_enum"]
          current_queue_id?: string | null
          current_support_level?: string
          customer_visible?: boolean
          deleted_at?: string | null
          description?: string
          external_reference?: string | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_internal_update_at?: string | null
          metadata?: Json
          origin_channel?: Database["public"]["Enums"]["support_origin_channel"]
          priority?: Database["public"]["Enums"]["support_priority"]
          public_code?: string | null
          requester_email?: string | null
          requester_level?: number | null
          requester_name?: string
          requester_phone?: string | null
          requester_user_id?: string | null
          resolution_due_at?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: number | null
          service_name?: string | null
          severity?: Database["public"]["Enums"]["support_severity"]
          sla_policy_id?: string | null
          source_system?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subcategory?: string | null
          support_level?: Database["public"]["Enums"]["support_level_enum"]
          support_resolved_by?: string | null
          ticket_number?: number | null
          ticket_type?: string
          title?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_current_queue_id_fkey"
            columns: ["current_queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_types"
            referencedColumns: ["id"]
          },
        ]
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
      user_commission_overrides: {
        Row: {
          commission_pct_override: number | null
          created_at: string
          created_by_email: string | null
          created_by_name: string | null
          external_user_id: number
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          commission_pct_override?: number | null
          created_at?: string
          created_by_email?: string | null
          created_by_name?: string | null
          external_user_id: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          commission_pct_override?: number | null
          created_at?: string
          created_by_email?: string | null
          created_by_name?: string | null
          external_user_id?: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_slug_fkey"
            columns: ["role_slug"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_contract_from_proposal: { Args: { payload: Json }; Returns: Json }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      is_profile_admin: { Args: never; Returns: boolean }
      is_support_admin_or_manager: { Args: never; Returns: boolean }
      is_support_internal: { Args: never; Returns: boolean }
      is_tech_admin: { Args: never; Returns: boolean }
      is_tech_team_member: { Args: never; Returns: boolean }
      rbac_can_access_owner_or_team: {
        Args: {
          p_app_code: string
          p_owner_team_id: string
          p_owner_user_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      rbac_get_app_id: { Args: { p_app_code: string }; Returns: string }
      rbac_get_effective_read_scope: {
        Args: { p_module_code: string; p_user_id: string }
        Returns: string
      }
      rbac_get_scope_type: {
        Args: { p_app_code: string; p_user_id: string }
        Returns: string
      }
      rbac_get_team_id: {
        Args: { p_app_code: string; p_user_id: string }
        Returns: string
      }
      rbac_get_user_role_code: {
        Args: { p_app_code: string; p_user_id: string }
        Returns: string
      }
      rbac_has_any_read_permission: {
        Args: { p_module_code: string; p_user_id: string }
        Returns: boolean
      }
      rbac_has_permission: {
        Args: { p_permission_key: string; p_user_id: string }
        Returns: boolean
      }
      rbac_has_role: {
        Args: { p_app_code: string; p_role_code: string; p_user_id: string }
        Returns: boolean
      }
      rbac_is_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      save_calculator_proposal: { Args: { payload: Json }; Returns: string }
    }
    Enums: {
      academy_enrollment_status:
        | "pending"
        | "active"
        | "suspended"
        | "expired"
        | "rejected"
      academy_institution_type:
        | "Universidade"
        | "Escola"
        | "Instituto"
        | "Empresa"
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
      participant_role: "EXECUTIVE" | "MANAGER" | "CS" | "ARCHITECT"
      root_cause_category:
        | "HARDWARE"
        | "CONFIG"
        | "HUMANO"
        | "EXTERNO"
        | "DESCONHECIDO"
      sla_level: "PADRAO" | "PREMIUM" | "CRITICO"
      support_author_type:
        | "client"
        | "support"
        | "cs"
        | "manager"
        | "system"
        | "integration"
      support_level_enum: "N1" | "N2" | "N3"
      support_origin_channel:
        | "portal"
        | "internal_portal"
        | "zabbix"
        | "api"
        | "email"
      support_priority: "critical" | "high" | "medium" | "low"
      support_queue_enum: "N1" | "N2" | "N3" | "CS"
      support_severity: "S1" | "S2" | "S3" | "S4"
      support_ticket_status:
        | "novo"
        | "triagem"
        | "em_atendimento"
        | "aguardando_cliente"
        | "aguardando_terceiro"
        | "escalado_n2"
        | "escalado_n3"
        | "resolvido_suporte"
        | "encerrado_cs"
        | "reaberto"
        | "cancelado"
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
      academy_enrollment_status: [
        "pending",
        "active",
        "suspended",
        "expired",
        "rejected",
      ],
      academy_institution_type: [
        "Universidade",
        "Escola",
        "Instituto",
        "Empresa",
      ],
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
      participant_role: ["EXECUTIVE", "MANAGER", "CS", "ARCHITECT"],
      root_cause_category: [
        "HARDWARE",
        "CONFIG",
        "HUMANO",
        "EXTERNO",
        "DESCONHECIDO",
      ],
      sla_level: ["PADRAO", "PREMIUM", "CRITICO"],
      support_author_type: [
        "client",
        "support",
        "cs",
        "manager",
        "system",
        "integration",
      ],
      support_level_enum: ["N1", "N2", "N3"],
      support_origin_channel: [
        "portal",
        "internal_portal",
        "zabbix",
        "api",
        "email",
      ],
      support_priority: ["critical", "high", "medium", "low"],
      support_queue_enum: ["N1", "N2", "N3", "CS"],
      support_severity: ["S1", "S2", "S3", "S4"],
      support_ticket_status: [
        "novo",
        "triagem",
        "em_atendimento",
        "aguardando_cliente",
        "aguardando_terceiro",
        "escalado_n2",
        "escalado_n3",
        "resolvido_suporte",
        "encerrado_cs",
        "reaberto",
        "cancelado",
      ],
      tech_role: ["ADMIN", "N1", "N2", "N3", "CS"],
    },
  },
} as const
