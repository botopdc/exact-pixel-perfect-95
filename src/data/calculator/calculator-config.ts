import { get } from "../api";

export const dataCenters = [
  { key: "SP1", city: "São Paulo", country: "BR" },
  { key: "SP2", city: "São Paulo", country: "BR" },
  { key: "FL1", city: "Florida", country: "US" },
  { key: "CE1", city: "Ceará", country: "BR" },
];

export const proposalAcceptanceDays = [
  { value: 7, label: "7 dias" },
  { value: 15, label: "15 dias" },
  { value: 30, label: "30 dias" },
];

export const  calculatorConfigKeys = {
  vCpu: 'vcpu',
};

export interface CalculatorConfig {
  /** Unique id that identifies the config item */
  id: number;

  /** Unique key generated from label, used for identification */
  key: string;

  /** Human-readable label for the config item */
  label: string;

  /** Numerical value associated with the config item. Most cases represent price */
  value: number;
  meta: {
    category: string;
    section: string;
    by?: string;
    type?: string;
    region?: string;
    retention?: string;
    min?: number;
    max?: number;
    description?: string;
  };
  created_at?: string;
  updated_at?: string;
}

const endpoint = '/calculator/config';

export const calculatorConfigGateway = {
  all() {
    return get<CalculatorConfig[]>(`${endpoint}/all`);
  }
}
