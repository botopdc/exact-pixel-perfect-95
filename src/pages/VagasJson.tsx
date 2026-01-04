import { useEffect, useState } from 'react';
import { jobsService } from '@/services/jobsService';

export default function VagasJson() {
  const [json, setJson] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJson();
  }, []);

  const loadJson = async () => {
    try {
      const data = await jobsService.getPublicJson();
      setJson(JSON.stringify(data, null, 2));
    } catch (error) {
      setJson(JSON.stringify({ error: 'Failed to load jobs' }));
    } finally {
      setLoading(false);
    }
  };

  // Set content-type header simulation for the rendered page
  useEffect(() => {
    document.title = 'vagas.json';
  }, []);

  if (loading) {
    return (
      <pre className="p-4 font-mono text-sm bg-background text-foreground min-h-screen">
        Loading...
      </pre>
    );
  }

  return (
    <pre className="p-4 font-mono text-sm bg-background text-foreground min-h-screen whitespace-pre-wrap">
      {json}
    </pre>
  );
}
