
-- Enum for asset types
CREATE TYPE public.cert_asset_type AS ENUM ('VM', 'BAREMETAL', 'GPU', 'KUBERNETES', 'STORAGE', 'FIREWALL', 'LOAD_BALANCER');

-- Enum for asset status
CREATE TYPE public.cert_asset_status AS ENUM ('ATIVO', 'MANUTENCAO', 'DESLIGADO', 'PROVISIONANDO');

-- Enum for datacenter locations
CREATE TYPE public.cert_datacenter AS ENUM ('DC1_SP', 'DC2_SP', 'DC3_RJ', 'CLOUD_AWS', 'CLOUD_GCP', 'CLOUD_AZURE');

-- Customers table (infrastructure clients)
CREATE TABLE public.cert_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE,
    segmento TEXT,
    cidade TEXT,
    uf TEXT,
    tem_suporte BOOLEAN DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Customer contacts
CREATE TABLE public.cert_customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.cert_customers(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    cargo TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Assets (VMs, bare metals, etc)
CREATE TABLE public.cert_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.cert_customers(id) ON DELETE CASCADE,
    asset_code TEXT NOT NULL UNIQUE,
    tipo public.cert_asset_type NOT NULL,
    datacenter public.cert_datacenter NOT NULL,
    sistema_operacional TEXT,
    status public.cert_asset_status DEFAULT 'ATIVO',
    hostname TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Asset resources (CPU, RAM, backup config)
CREATE TABLE public.cert_asset_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.cert_assets(id) ON DELETE CASCADE UNIQUE,
    vcpu INTEGER DEFAULT 0,
    ram_gb INTEGER DEFAULT 0,
    backup_ativo BOOLEAN DEFAULT false,
    backup_retencao_dias INTEGER,
    backup_janela TEXT,
    firewall_ativo BOOLEAN DEFAULT false,
    servicos_adicionais TEXT[],
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Asset network/IPs
CREATE TABLE public.cert_asset_network (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.cert_assets(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    tipo TEXT DEFAULT 'IPv4',
    is_primary BOOLEAN DEFAULT false,
    vlan TEXT,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Asset disks
CREATE TABLE public.cert_asset_disks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.cert_assets(id) ON DELETE CASCADE,
    tamanho_gb INTEGER NOT NULL,
    tipo TEXT DEFAULT 'SSD',
    mount_point TEXT,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Asset licenses
CREATE TABLE public.cert_asset_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.cert_assets(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    quantidade INTEGER DEFAULT 1,
    validade DATE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Asset access credentials
CREATE TABLE public.cert_asset_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.cert_assets(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    host TEXT,
    porta INTEGER,
    usuario TEXT,
    senha_ref TEXT,
    instrucoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Proposal links (related proposals)
CREATE TABLE public.cert_proposal_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.cert_customers(id) ON DELETE CASCADE,
    proposal_id TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Audit logs for all changes
CREATE TABLE public.cert_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    changes JSONB,
    user_id TEXT,
    user_name TEXT,
    user_level INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.cert_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_asset_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_asset_network ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_asset_disks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_asset_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_asset_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_proposal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for tech team members (level >= 900)
CREATE POLICY "cert_customers_select" ON public.cert_customers FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_customers_insert" ON public.cert_customers FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_customers_update" ON public.cert_customers FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_customers_delete" ON public.cert_customers FOR DELETE USING (is_tech_admin());

CREATE POLICY "cert_customer_contacts_select" ON public.cert_customer_contacts FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_customer_contacts_insert" ON public.cert_customer_contacts FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_customer_contacts_update" ON public.cert_customer_contacts FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_customer_contacts_delete" ON public.cert_customer_contacts FOR DELETE USING (is_tech_team_member());

CREATE POLICY "cert_assets_select" ON public.cert_assets FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_assets_insert" ON public.cert_assets FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_assets_update" ON public.cert_assets FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_assets_delete" ON public.cert_assets FOR DELETE USING (is_tech_admin());

CREATE POLICY "cert_asset_resources_select" ON public.cert_asset_resources FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_asset_resources_insert" ON public.cert_asset_resources FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_asset_resources_update" ON public.cert_asset_resources FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_asset_resources_delete" ON public.cert_asset_resources FOR DELETE USING (is_tech_team_member());

CREATE POLICY "cert_asset_network_select" ON public.cert_asset_network FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_asset_network_insert" ON public.cert_asset_network FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_asset_network_update" ON public.cert_asset_network FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_asset_network_delete" ON public.cert_asset_network FOR DELETE USING (is_tech_team_member());

CREATE POLICY "cert_asset_disks_select" ON public.cert_asset_disks FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_asset_disks_insert" ON public.cert_asset_disks FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_asset_disks_update" ON public.cert_asset_disks FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_asset_disks_delete" ON public.cert_asset_disks FOR DELETE USING (is_tech_team_member());

CREATE POLICY "cert_asset_licenses_select" ON public.cert_asset_licenses FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_asset_licenses_insert" ON public.cert_asset_licenses FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_asset_licenses_update" ON public.cert_asset_licenses FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_asset_licenses_delete" ON public.cert_asset_licenses FOR DELETE USING (is_tech_team_member());

CREATE POLICY "cert_asset_access_select" ON public.cert_asset_access FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_asset_access_insert" ON public.cert_asset_access FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_asset_access_update" ON public.cert_asset_access FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_asset_access_delete" ON public.cert_asset_access FOR DELETE USING (is_tech_admin());

CREATE POLICY "cert_proposal_links_select" ON public.cert_proposal_links FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_proposal_links_insert" ON public.cert_proposal_links FOR INSERT WITH CHECK (is_tech_team_member());
CREATE POLICY "cert_proposal_links_update" ON public.cert_proposal_links FOR UPDATE USING (is_tech_team_member());
CREATE POLICY "cert_proposal_links_delete" ON public.cert_proposal_links FOR DELETE USING (is_tech_team_member());

CREATE POLICY "cert_audit_logs_select" ON public.cert_audit_logs FOR SELECT USING (is_tech_team_member());
CREATE POLICY "cert_audit_logs_insert" ON public.cert_audit_logs FOR INSERT WITH CHECK (is_tech_team_member());

-- Indexes for better performance
CREATE INDEX idx_cert_customers_cnpj ON public.cert_customers(cnpj);
CREATE INDEX idx_cert_customers_razao_social ON public.cert_customers(razao_social);
CREATE INDEX idx_cert_assets_customer ON public.cert_assets(customer_id);
CREATE INDEX idx_cert_assets_code ON public.cert_assets(asset_code);
CREATE INDEX idx_cert_asset_network_ip ON public.cert_asset_network(ip_address);
CREATE INDEX idx_cert_audit_logs_entity ON public.cert_audit_logs(entity_type, entity_id);

-- Triggers for updated_at
CREATE TRIGGER update_cert_customers_updated_at
    BEFORE UPDATE ON public.cert_customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cert_assets_updated_at
    BEFORE UPDATE ON public.cert_assets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cert_asset_resources_updated_at
    BEFORE UPDATE ON public.cert_asset_resources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cert_asset_access_updated_at
    BEFORE UPDATE ON public.cert_asset_access
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
