// ============================================================================
// SEED SERVICE - Para inserir dados de exemplo (ADMIN only)
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  TechRole,
  ClientStatus,
  SLALevel,
  AssetType,
  AssetStatus,
  AssetEnvironment,
  IncidentOrigin,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  OnCallLevel,
} from '@/types/techOps';

export interface SeedStep {
  name: string;
  table: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  count?: number;
}

export interface SeedResult {
  steps: SeedStep[];
  success: boolean;
  error?: string;
}

type DbTechRole = 'ADMIN' | 'N1' | 'N2' | 'N3' | 'CS';
type DbClientStatus = 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';
type DbSLALevel = 'PADRAO' | 'PREMIUM' | 'CRITICO';
type DbAssetType = 'VM' | 'BAREMETAL' | 'GPU' | 'KUBERNETES' | 'STORAGE';
type DbAssetStatus = 'ATIVO' | 'MANUTENCAO' | 'DESLIGADO';
type DbAssetEnvironment = 'PROD' | 'HOMOLOG' | 'DEV' | 'NAO_INFORMADO';
type DbIncidentOrigin = 'PORTAL_CLIENTE' | 'PORTAL_INTERNO' | 'EMAIL' | 'WHATSAPP' | 'INTERNO';
type DbIncidentType = 'QUEDA' | 'PERFORMANCE' | 'CONFIGURACAO' | 'DUVIDA' | 'MUDANCA' | 'OUTRO';
type DbIncidentSeverity = 'S1' | 'S2' | 'S3' | 'S4';
type DbIncidentStatus = 'ABERTO' | 'CLASSIFICADO' | 'EM_ATENDIMENTO' | 'ESCALADO' | 'RESOLVIDO' | 'ENCERRADO';
type DbOnCallLevel = 'N1' | 'N2' | 'N3';

// Sample data for seeding
const SAMPLE_USERS: Array<{
  name: string;
  email: string;
  role: DbTechRole;
  is_active: boolean;
}> = [
  { name: 'Admin Silva', email: 'admin@open.com', role: 'ADMIN', is_active: true },
  { name: 'Carlos N3 Senior', email: 'carlos.n3@open.com', role: 'N3', is_active: true },
  { name: 'Ana N2 Pleno', email: 'ana.n2@open.com', role: 'N2', is_active: true },
  { name: 'Pedro N1 Junior', email: 'pedro.n1@open.com', role: 'N1', is_active: true },
  { name: 'Maria CS', email: 'maria.cs@open.com', role: 'CS', is_active: true },
];

const SAMPLE_CLIENTS: Array<{
  razao_social: string;
  nome_fantasia: string;
  status: DbClientStatus;
  sla_level: DbSLALevel;
  segmento: string;
}> = [
  { razao_social: 'Alpha Tecnologia LTDA', nome_fantasia: 'Alpha Tech', status: 'ATIVO', sla_level: 'CRITICO', segmento: 'Fintech' },
  { razao_social: 'Beta Corporação SA', nome_fantasia: 'Beta Corp', status: 'ATIVO', sla_level: 'PREMIUM', segmento: 'E-commerce' },
  { razao_social: 'Gamma Indústria ME', nome_fantasia: 'Gamma Ind', status: 'ATIVO', sla_level: 'PADRAO', segmento: 'Indústria' },
  { razao_social: 'Delta Soluções EIRELI', nome_fantasia: 'Delta Sol', status: 'SUSPENSO', sla_level: 'PADRAO', segmento: 'Varejo' },
  { razao_social: 'Epsilon Digital SA', nome_fantasia: 'Epsilon', status: 'ATIVO', sla_level: 'PREMIUM', segmento: 'SaaS' },
];

export async function runSeed(
  onProgress: (steps: SeedStep[]) => void
): Promise<SeedResult> {
  const steps: SeedStep[] = [
    { name: 'Usuários', table: 'tech_users', status: 'pending' },
    { name: 'Clientes', table: 'tech_clients', status: 'pending' },
    { name: 'Assets', table: 'tech_assets', status: 'pending' },
    { name: 'Incidentes', table: 'tech_incidents', status: 'pending' },
    { name: 'Plantões', table: 'tech_on_call_shifts', status: 'pending' },
  ];

  const updateStep = (index: number, update: Partial<SeedStep>) => {
    steps[index] = { ...steps[index], ...update };
    onProgress([...steps]);
  };

  try {
    // Step 1: Users
    updateStep(0, { status: 'running' });
    const userIds: Record<string, string> = {};
    
    for (const user of SAMPLE_USERS) {
      const { data: existingUser } = await supabase
        .from('tech_users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (existingUser) {
        userIds[user.role] = existingUser.id;
      } else {
        const { data: newUser, error } = await supabase
          .from('tech_users')
          .insert(user)
          .select()
          .single();

        if (error) throw new Error(`Erro ao inserir usuário ${user.name}: ${error.message}`);
        if (newUser) userIds[user.role] = newUser.id;
      }
    }
    updateStep(0, { status: 'success', count: Object.keys(userIds).length, message: 'Usuários criados/verificados' });

    // Step 2: Clients
    updateStep(1, { status: 'running' });
    const clientIds: string[] = [];
    const clientData: Array<{ id: string; sla_level: string }> = [];

    for (const client of SAMPLE_CLIENTS) {
      const { data: existingClient } = await supabase
        .from('tech_clients')
        .select('id, sla_level')
        .eq('razao_social', client.razao_social)
        .single();

      if (existingClient) {
        clientIds.push(existingClient.id);
        clientData.push({ id: existingClient.id, sla_level: existingClient.sla_level });
      } else {
        const { data: newClient, error } = await supabase
          .from('tech_clients')
          .insert({
            ...client,
            cs_manager_id: userIds['CS'] || null,
          })
          .select()
          .single();

        if (error) throw new Error(`Erro ao inserir cliente ${client.razao_social}: ${error.message}`);
        if (newClient) {
          clientIds.push(newClient.id);
          clientData.push({ id: newClient.id, sla_level: newClient.sla_level });
        }
      }
    }
    updateStep(1, { status: 'success', count: clientIds.length, message: 'Clientes criados/verificados' });

    // Step 3: Assets
    updateStep(2, { status: 'running' });
    let assetCount = 0;
    const assetIds: string[] = [];

    if (clientIds.length > 0) {
      const sampleAssets: Array<{
        client_id: string;
        tipo: DbAssetType;
        ambiente: DbAssetEnvironment;
        identificador: string;
        ip_principal: string | null;
        cpu: string | null;
        memoria_gb: number | null;
        disco_gb: number | null;
        status: DbAssetStatus;
      }> = [
        // Client 1 assets
        { client_id: clientIds[0], tipo: 'VM', ambiente: 'PROD', identificador: 'ALPHA-PROD-WEB-01', ip_principal: '10.0.1.10', cpu: '8 vCPU', memoria_gb: 32, disco_gb: 500, status: 'ATIVO' },
        { client_id: clientIds[0], tipo: 'VM', ambiente: 'PROD', identificador: 'ALPHA-PROD-DB-01', ip_principal: '10.0.1.11', cpu: '16 vCPU', memoria_gb: 64, disco_gb: 2000, status: 'ATIVO' },
        { client_id: clientIds[0], tipo: 'BAREMETAL', ambiente: 'PROD', identificador: 'ALPHA-PROD-BM-01', ip_principal: '10.0.1.100', cpu: 'Intel Xeon 32 cores', memoria_gb: 256, disco_gb: 10000, status: 'ATIVO' },
      ];

      if (clientIds.length > 1) {
        sampleAssets.push(
          { client_id: clientIds[1], tipo: 'VM', ambiente: 'PROD', identificador: 'BETA-PROD-APP-01', ip_principal: '10.1.1.10', cpu: '8 vCPU', memoria_gb: 32, disco_gb: 500, status: 'ATIVO' },
          { client_id: clientIds[1], tipo: 'GPU', ambiente: 'PROD', identificador: 'BETA-PROD-GPU-01', ip_principal: '10.1.1.50', cpu: 'NVIDIA A100', memoria_gb: 128, disco_gb: 1000, status: 'ATIVO' }
        );
      }

      if (clientIds.length > 2) {
        sampleAssets.push(
          { client_id: clientIds[2], tipo: 'VM', ambiente: 'PROD', identificador: 'GAMMA-PROD-ERP-01', ip_principal: '10.2.1.10', cpu: '8 vCPU', memoria_gb: 32, disco_gb: 1000, status: 'ATIVO' }
        );
      }

      if (clientIds.length > 4) {
        sampleAssets.push(
          { client_id: clientIds[4], tipo: 'KUBERNETES', ambiente: 'PROD', identificador: 'EPSILON-K8S-CLUSTER', ip_principal: '10.4.1.1', cpu: '32 vCPU total', memoria_gb: 128, disco_gb: 2000, status: 'ATIVO' }
        );
      }

      for (const asset of sampleAssets) {
        const { data: existingAsset } = await supabase
          .from('tech_assets')
          .select('id')
          .eq('identificador', asset.identificador)
          .single();

        if (existingAsset) {
          assetIds.push(existingAsset.id);
          assetCount++;
        } else {
          const { data: newAsset, error } = await supabase
            .from('tech_assets')
            .insert(asset)
            .select()
            .single();

          if (error) throw new Error(`Erro ao inserir asset ${asset.identificador}: ${error.message}`);
          if (newAsset) {
            assetIds.push(newAsset.id);
            assetCount++;
          }
        }
      }
    }
    updateStep(2, { status: 'success', count: assetCount, message: 'Assets criados/verificados' });

    // Step 4: Incidents
    updateStep(3, { status: 'running' });
    let incidentCount = 0;

    if (clientIds.length > 0 && assetIds.length > 0) {
      const now = new Date();
      const sampleIncidents: Array<{
        client_id: string;
        asset_id: string | null;
        origin_channel: DbIncidentOrigin;
        tipo: DbIncidentType;
        severidade: DbIncidentSeverity;
        status: DbIncidentStatus;
        sla_level_aplicado: DbSLALevel;
        owner_user_id: string | null;
        title: string;
        description: string | null;
        opened_at: string;
      }> = [
        {
          client_id: clientIds[0],
          asset_id: assetIds[1] || null,
          origin_channel: 'WHATSAPP',
          tipo: 'QUEDA',
          severidade: 'S1',
          status: 'EM_ATENDIMENTO',
          sla_level_aplicado: (clientData[0]?.sla_level as DbSLALevel) || 'CRITICO',
          owner_user_id: userIds['N3'] || null,
          title: 'Servidor de banco de dados fora do ar',
          description: 'Cliente reporta que o servidor está inacessível desde as 14h.',
          opened_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          client_id: clientIds[0],
          asset_id: assetIds[0] || null,
          origin_channel: 'PORTAL_CLIENTE',
          tipo: 'PERFORMANCE',
          severidade: 'S2',
          status: 'CLASSIFICADO',
          sla_level_aplicado: (clientData[0]?.sla_level as DbSLALevel) || 'CRITICO',
          owner_user_id: null,
          title: 'Lentidão no servidor web',
          description: 'Aplicação apresentando tempo de resposta alto.',
          opened_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        },
      ];

      if (clientIds.length > 1 && assetIds.length > 3) {
        sampleIncidents.push({
          client_id: clientIds[1],
          asset_id: assetIds[3] || null,
          origin_channel: 'EMAIL',
          tipo: 'CONFIGURACAO',
          severidade: 'S3',
          status: 'ABERTO',
          sla_level_aplicado: (clientData[1]?.sla_level as DbSLALevel) || 'PREMIUM',
          owner_user_id: null,
          title: 'Erro de configuração de rede',
          description: 'Solicitação de ajuste nas regras de firewall.',
          opened_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        });
      }

      if (clientIds.length > 2 && assetIds.length > 5) {
        sampleIncidents.push({
          client_id: clientIds[2],
          asset_id: assetIds[5] || null,
          origin_channel: 'PORTAL_INTERNO',
          tipo: 'MUDANCA',
          severidade: 'S4',
          status: 'RESOLVIDO',
          sla_level_aplicado: (clientData[2]?.sla_level as DbSLALevel) || 'PADRAO',
          owner_user_id: userIds['N2'] || null,
          title: 'Upgrade de memória solicitado',
          description: 'Cliente solicitou aumento de RAM.',
          opened_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      for (const incident of sampleIncidents) {
        const { data: existingIncident } = await supabase
          .from('tech_incidents')
          .select('id')
          .eq('title', incident.title)
          .eq('client_id', incident.client_id)
          .single();

        if (!existingIncident) {
          const { error } = await supabase
            .from('tech_incidents')
            .insert(incident);

          if (error) throw new Error(`Erro ao inserir incidente "${incident.title}": ${error.message}`);
          incidentCount++;
        } else {
          incidentCount++;
        }
      }
    }
    updateStep(3, { status: 'success', count: incidentCount, message: 'Incidentes criados/verificados' });

    // Step 5: On-Call Shifts
    updateStep(4, { status: 'running' });
    let shiftCount = 0;

    const now = new Date();
    const shiftStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const shiftEnd = new Date(now.getTime() + 20 * 60 * 60 * 1000);

    const onCallUsers = [
      { user_id: userIds['N1'], level: 'N1' as DbOnCallLevel },
      { user_id: userIds['N2'], level: 'N2' as DbOnCallLevel },
      { user_id: userIds['N3'], level: 'N3' as DbOnCallLevel },
    ].filter(u => u.user_id);

    for (const shift of onCallUsers) {
      const { data: existingShift } = await supabase
        .from('tech_on_call_shifts')
        .select('id')
        .eq('user_id', shift.user_id)
        .eq('is_active', true)
        .gte('end_at', now.toISOString())
        .single();

      if (!existingShift) {
        const { error } = await supabase
          .from('tech_on_call_shifts')
          .insert({
            user_id: shift.user_id,
            level: shift.level,
            start_at: shiftStart.toISOString(),
            end_at: shiftEnd.toISOString(),
            is_active: true,
          });

        if (error) throw new Error(`Erro ao inserir plantão ${shift.level}: ${error.message}`);
        shiftCount++;
      } else {
        shiftCount++;
      }
    }
    updateStep(4, { status: 'success', count: shiftCount, message: 'Plantões criados/verificados' });

    return { steps, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const failedStepIndex = steps.findIndex(s => s.status === 'running');
    if (failedStepIndex >= 0) {
      updateStep(failedStepIndex, { status: 'error', message: errorMessage });
    }
    return { steps, success: false, error: errorMessage };
  }
}

export async function clearSeedData(): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete in reverse order of dependencies
    await supabase.from('tech_on_call_shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_incident_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_incident_root_cause').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_incidents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_credentials').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tech_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
