import OpenCalculator from '@/components/OpenCalculator';

/**
 * Calculadora de Preços para Parceiros
 * Renderiza o mesmo componente OpenCalculator, mas dentro do PartnerLayout
 * O contexto de parceiro é detectado automaticamente pelo OpenCalculator
 * através do partnerAuthService.getSession()
 */
export default function CalculadoraParceiro() {
  return (
    <div className="h-full -m-6">
      <div className="h-full overflow-auto">
        <OpenCalculator />
      </div>
    </div>
  );
}
