import React, { useState, useEffect } from 'react';
import { partnerAuthService } from '@/services/partnersService';
import { PARTNER_DISCOUNTS, PARTNER_TYPE_LABELS } from '@/types/partner';
import OpenCalculator from '@/components/OpenCalculator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Percent, Info } from 'lucide-react';

export default function CalculadoraParceiro() {
  const session = partnerAuthService.getSession();

  if (!session) return null;

  const discount = PARTNER_DISCOUNTS[session.tipo_parceria];
  const discountPercent = (discount * 100).toFixed(0);

  return (
    <div className="h-full -m-6 flex flex-col">
      {/* Discount Banner */}
      {discount > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-b border-emerald-500/30 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <Percent className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  Desconto de Parceiro {session.tipo_parceria}
                </p>
                <p className="text-xs text-emerald-400/70">
                  {discountPercent}% aplicado automaticamente no valor final
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/30 text-emerald-400 border-emerald-500/50 text-lg px-4 py-1">
              -{discountPercent}%
            </Badge>
          </div>
        </div>
      )}

      {/* Calculator with discount context */}
      <div className="flex-1 overflow-auto">
        <PartnerCalculatorWrapper discount={discount} partnerType={session.tipo_parceria} />
      </div>
    </div>
  );
}

interface PartnerCalculatorWrapperProps {
  discount: number;
  partnerType: string;
}

function PartnerCalculatorWrapper({ discount, partnerType }: PartnerCalculatorWrapperProps) {
  // Pass discount to calculator context
  useEffect(() => {
    // Store partner discount in localStorage for calculator to read
    localStorage.setItem('open_partner_discount', JSON.stringify({
      discount,
      partnerType,
      timestamp: Date.now(),
    }));

    return () => {
      localStorage.removeItem('open_partner_discount');
    };
  }, [discount, partnerType]);

  return <OpenCalculator />;
}
