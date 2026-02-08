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
  name?: string;
  _subs?: string[];
}

export function useProposalCalculator(props: ProposalCalculatorProps) {
  const [result, setResult] = useState<ResultItem[]>([]);

  const total = result.reduce((sum, item) => sum + item.current_price, 0);

  const subResources = result
    .filter((item) => item._subs?.includes("resources"))
    .reduce((sum, item) => sum + item.current_price, 0);
  const subIps = result
    .filter((item) => item._subs?.includes("ips"))
    .reduce((sum, item) => sum + item.current_price, 0);
  const subServices = result
    .filter((item) => item._subs?.includes("services"))
    .reduce((sum, item) => sum + item.current_price, 0);
  const subBackup = result
    .filter((item) => item._subs?.includes("backup"))
    .reduce((sum, item) => sum + item.current_price, 0);
  const subKubernetes = result
    .filter((item) => item._subs?.includes("kubernetes"))
    .reduce((sum, item) => sum + item.current_price, 0);

  useEffect(() => {
    const items: ResultItem[] = [];

    // Process servers specs
    props.proposal.servers?.forEach((server) => {
      const serverQuantity = Number(server.quantity) || 1;
      server.specs?.forEach((spec) => {
        const configItem = props.config.findById(spec.config_id);
        const specQuantity = Number(spec.quantity) || 0;
        const originalPrice =
          (configItem?.value || 0) * specQuantity * serverQuantity;

        // Categorize by config key
        const subs: string[] = [];
        if (configItem?.key === "ip-publico") {
          subs.push("ips");
        } else {
          subs.push("resources");
        }

        items.push({
          name: server.name,
          config_id: spec.config_id,
          quantity: specQuantity * serverQuantity,
          original_price: originalPrice,
          current_price: originalPrice,
          _subs: subs,
        });
      });
    });

    // Process addons
    props.proposal.addons
      ?.filter((addon) => Number(addon.quantity) > 0)
      .forEach((addon) => {
        const configItem = props.config.findById(addon.config_id);
        const quantity = Number(addon.quantity) || 0;
        const originalPrice = (configItem?.value || 0) * quantity;

        // Categorize by config key
        const subs: string[] = [];
        const key = configItem?.key || "";

        if (key.includes("backup")) {
          subs.push("backup");
        } else if (key.includes("kubernetes") || key.includes("k8s")) {
          subs.push("kubernetes");
        } else if (key.includes("storage")) {
          subs.push("storage");
        } else if (key.includes("opensaas") || key.includes("open_saas")) {
          subs.push("opensaas");
        } else {
          // Default to services for all other addons
          subs.push("services");
        }

        items.push({
          config_id: addon.config_id,
          quantity: quantity,
          original_price: originalPrice,
          current_price: originalPrice,
          _subs: subs,
        });
      });

    setResult(items);
  }, [props.proposal.addons, props.proposal.servers, props.config]);

  return {
    result,
    setResult,
    total,
    sub: {
      resources: subResources,
      ips: subIps,
      services: subServices,
      backup: subBackup,
      kubernetes: subKubernetes,
    },
  };
}
