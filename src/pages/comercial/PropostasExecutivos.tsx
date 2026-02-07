/**
 * Propostas Executivos - Unified Supabase-based proposal list
 * 
 * This component now uses SupabaseProposalsList as the single source of truth.
 * The legacy API-based SavedProposals component is deprecated.
 */
import SupabaseProposalsList from '@/components/SupabaseProposalsList';

const PropostasExecutivos = () => {
  return <SupabaseProposalsList />;
};

export default PropostasExecutivos;
