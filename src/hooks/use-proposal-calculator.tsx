import { CalculatorProposal } from "@/data/calculator/calculator-proposal";
import { useCalculatorConfig } from "./useCalculatorConfig";
import { useEffect, useState } from "react";

export interface ProposalCalculatorProps {
  config: ReturnType<typeof useCalculatorConfig>;
  proposal: Partial<CalculatorProposal>;
}

export interface ResultItem {
  original_price: number;
  current_price: number;
  config_id: number;
  quantity: number;
  price?: number;
}

export function useProposalCalculator(props: ProposalCalculatorProps) {
  const [result, setResult] = useState<ResultItem[]>([]);

  useEffect(() => {
    setResult(
      props.proposal.addons
        ?.filter((addon) => Number(addon.quantity) > 0)
        .map((addon) => {
          const configItem = props.config.findById(addon.config_id);
          const originalPrice =
            (configItem?.value || 0) * (Number(addon.quantity) || 0);

          return {
            ...addon,
            original_price: originalPrice,
            current_price: originalPrice,
          };
        }),
    );
  }, [props.proposal.addons, props.proposal.servers]);

  return {
    result,
    setResult,
  };
}
