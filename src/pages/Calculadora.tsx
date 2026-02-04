import OpenCalculator from '@/components/OpenCalculatorNovo';

export default function CalculadoraPage() {
  return (
    <div className="h-full -m-6">
      {/* Remove padding from parent and let calculator handle its own layout */}
      <div className="h-full overflow-auto">
        <OpenCalculator />
      </div>
    </div>
  );
}
