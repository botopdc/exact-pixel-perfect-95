/**
 * Calculator State Module - Centralized exports
 * 
 * This module provides the unified state management for the calculator:
 * - OpenCalculatorState: The single state contract
 * - hydrateProposalForEdit: API → State (for editing)
 * - serializeProposal: State → API (for saving)
 * - useCalculatorState: React hook for state management
 */

export {
  // State types
  type OpenCalculatorState,
  type AddonsStateV2,
  type KubernetesStateV2,
  type OpenSaaSStateV2,
  type ResellerStateV2,
  type StorageItemV2,
  type ServerItemV2,
  type VMItemV2,
  type BMItemV2,
  type DiskItemV2,
  type ProposalMetaV2,
  type ClientInfoV2,
  type CalculatedTotals,
  type CalculatorFlags,
  type K8sAddonsV2,
  type K8sExtrasV2,
  
  // Defaults
  DEFAULT_ADDONS,
  DEFAULT_KUBERNETES,
  DEFAULT_OPEN_SAAS,
  DEFAULT_RESELLER,
  
  // Factory
  createDefaultCalculatorState,
  
  // Type guards
  isVMItem,
  isBMItem,
} from './openCalculatorState';

export {
  // Mappers
  hydrateProposalForEdit,
  serializeProposal,
  stateToLegacyFormat,
  type ApiProposalPayload,
  type ApiAddonPayload,
  type ApiServerPayload,
  type ApiServerSpec,
} from './proposalMappers';

export {
  // Hook
  useCalculatorState,
  type UseCalculatorStateReturn,
} from './useCalculatorState';
