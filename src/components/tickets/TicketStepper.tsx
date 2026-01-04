import { TicketStatus, STATUS_LABELS, TICKET_FLOW_STEPS } from '@/types/ticket';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TicketStepperProps {
  currentStatus: TicketStatus;
}

export function TicketStepper({ currentStatus }: TicketStepperProps) {
  const currentIndex = TICKET_FLOW_STEPS.findIndex(step => step.status === currentStatus);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {TICKET_FLOW_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.status} className="flex flex-col items-center flex-1">
              {/* Connector line (except first) */}
              <div className="flex items-center w-full">
                {index > 0 && (
                  <div 
                    className={cn(
                      "flex-1 h-0.5 transition-colors",
                      isCompleted || isCurrent ? "bg-primary" : "bg-muted"
                    )} 
                  />
                )}
                
                {/* Step circle */}
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all shrink-0",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    isPending && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                {index < TICKET_FLOW_STEPS.length - 1 && (
                  <div 
                    className={cn(
                      "flex-1 h-0.5 transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} 
                  />
                )}
              </div>

              {/* Label */}
              <span 
                className={cn(
                  "mt-2 text-xs text-center max-w-[80px] leading-tight",
                  isCurrent && "text-primary font-medium",
                  isPending && "text-muted-foreground",
                  isCompleted && "text-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
