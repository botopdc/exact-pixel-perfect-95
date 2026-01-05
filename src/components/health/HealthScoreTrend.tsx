import { HealthScoreHistoryItem } from '@/types/healthScore';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

interface HealthScoreTrendProps {
  history: HealthScoreHistoryItem[];
  height?: number;
}

export function HealthScoreTrend({ history, height = 40 }: HealthScoreTrendProps) {
  if (history.length < 2) {
    return <span className="text-xs text-muted-foreground">Sem histórico</span>;
  }

  const data = history.slice(-7).map(h => ({
    data: h.data,
    score: h.score,
  }));

  // Determine trend color
  const lastScore = data[data.length - 1]?.score || 0;
  const firstScore = data[0]?.score || 0;
  const trend = lastScore - firstScore;
  const color = trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#eab308';

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <YAxis domain={[0, 100]} hide />
          <Tooltip 
            formatter={(value: number) => [`${value}`, 'Score']}
            labelFormatter={(label) => `Data: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke={color} 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
