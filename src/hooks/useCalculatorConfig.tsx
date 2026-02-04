import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  CalculatorConfig,
  calculatorConfigGateway,
} from "@/data/calculator/calculator-config";

export function useCalculatorConfig() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<CalculatorConfig[]>([]);

  const vcpu = findByKey("vcpu");
  const ram = findByKey("ram");
  const nvme = findByKey("nvme");
  const ipPublico = findByKey("ip-publico");
  const antivirus = findByKey("antivirus");
  const firewall = findByKey("firewall");
  const tsplus = findByKey("tsplus");
  const cal = findByKey("cal");
  const veeamVm = findByKey("veeam-vm");
  const veeamAgent = findByKey("veeam-agent");
  const winserver2vcpuunid = findByKey("winserver2vcpuunid");
  const sqlNone = findByKey("nenhum");
  const sqlStd = findByKey("web");
  const sqlEnt = findByKey("std");
  const sqlConfigs = [sqlNone, sqlStd, sqlEnt];
  const dba = findByKey("dba");
  const consultoriaTecnica = findByKey("consultoria-tecnica");
  const planK8sSmall = findByKey("small");
  const planK8sMedium = findByKey("medium");
  const planK8sLarge = findByKey("large");
  const plansK8s = [planK8sSmall, planK8sMedium, planK8sLarge];
  const gpuNvidiaT4 = findByKey("nvidia-t4");
  const gpuNvidiaL4 = findByKey("nvidia-l4-24gb");
  const gpuNvidiaA10 = findByKey("nvidia-a10-24gb");
  const gpuNvidiaA40 = findByKey("nvidia-a40-48gb");
  const gpuNvidiaA100_40gb = findByKey("nvidia-a100-40gb");
  const gpuNvidiaA100_80gb = findByKey("nvidia-a100-80gb");
  const gpuNvidiaA2000 = findByKey("nvidia-a2000-12gb");
  const gpuNvidiaV100 = findByKey("nvidia-v100-16gb");
  const gpuNvidiaH100 = findByKey("nvidia-h100-80gb");
  const gpuNvidiaRtxA4000 = findByKey("nvidia-rtx-a4000-16gb");
  const gpuNvidiaRtxA5000 = findByKey("nvidia-rtx-a5000-24gb");
  const gpus = [gpuNvidiaT4, gpuNvidiaL4, gpuNvidiaA10, gpuNvidiaA40, gpuNvidiaA100_40gb, gpuNvidiaA100_80gb, gpuNvidiaA2000, gpuNvidiaV100, gpuNvidiaH100, gpuNvidiaRtxA4000, gpuNvidiaRtxA5000];
  const contractPlans = filterByKey([
    "1-mes",
    "12-meses",
    "24-meses",
    "36-meses",
    "48-meses",
  ]);

  async function loadAll() {
    const response = await calculatorConfigGateway.all();
    if (response.isError) {
      toast({
        title: "Erro",
        description:
          "Não foi possível carregar as configurações da calculadora",
        variant: "destructive",
      });
      return;
    }
    setConfigs(response.data);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function findByKey(key: string) {
    return configs.find((config) => config.key === key);
  }

  function filterByKey(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key];
    return configs.filter((config) => keys.includes(config.key));
  }

  return {
    configs,
    findByKey,
    filterByKey,

    vcpu,
    ram,
    nvme,
    ipPublico,
    contractPlans,
    antivirus,
    firewall,
    tsplus,
    cal,
    veeamVm,
    veeamAgent,
    winserver2vcpuunid,
    sqlNone,
    sqlStd,
    sqlEnt,
    sqlConfigs,
    dba,
    consultoriaTecnica,
    planK8sSmall,
    planK8sMedium,
    planK8sLarge,
    plansK8s,
    gpuNvidiaT4,
    gpuNvidiaL4,
    gpuNvidiaA10,
    gpuNvidiaA40,
    gpuNvidiaA100_40gb,
    gpuNvidiaA100_80gb,
    gpuNvidiaA2000,
    gpuNvidiaV100,
    gpuNvidiaH100,
    gpuNvidiaRtxA4000,
    gpuNvidiaRtxA5000,
    gpus
  };
}
