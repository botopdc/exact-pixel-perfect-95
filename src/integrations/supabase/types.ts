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
          assigned_team: string | null
          assigned_to_name: string | null
          assigned_to_user_id: string | null
          category: string
          closed_at: string | null
          company_id: string | null
          created_at: string
          cs_closed_by: string | null
          current_queue: Database["public"]["Enums"]["support_queue_enum"]
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
          resolved_at: string | null
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
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          asset_label?: string | null
          assigned_team?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          category: string
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          cs_closed_by?: string | null
          current_queue?: Database["public"]["Enums"]["support_queue_enum"]
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
          resolved_at?: string | null
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
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          asset_label?: string | null
          assigned_team?: string | null
          assigned_to_name?: string | null
          assigned_to_user_id?: string | null
          category?: string
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          cs_closed_by?: string | null
          current_queue?: Database["public"]["Enums"]["support_queue_enum"]
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
          resolved_at?: string | null
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
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_contract_from_proposal: { Args: { payload: Json }; Returns: Json }
      is_support_admin_or_manager: { Args: never; Returns: boolean }
      is_support_internal: { Args: never; Returns: boolean }
      is_tech_admin: { Args: never; Returns: boolean }
      is_tech_team_member: { Args: never; Returns: boolean }
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
