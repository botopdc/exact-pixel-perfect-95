import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { openApi } from '@/lib/openApi';
import { authService } from '@/services/authService';
import { CheckCircle, XCircle, Loader2, Play, AlertTriangle, ArrowLeft, Shield } from 'lucide-react';

interface TestResult {
  name: string;
  endpoint: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'warning';
  message?: string;
  data?: unknown;
  responseTime?: number;
}

interface LocalStorageAudit {
  key: string;
  type: 'allowed' | 'forbidden';
  reason: string;
  size: number;
}

// Keys that are allowed in localStorage (UI preferences only)
const ALLOWED_KEYS = [
  'open-datacenter-theme',
  'open_access_token',
  'open_api_token',
  'open_auth_session_v1',
  'open_partner_session_v1',
  'open_precos_adminMode',
  'open_partner_discount', // Temporary partner discount context
];

// Keys that are forbidden (business data)
const FORBIDDEN_PATTERNS = [
  'proposal',
  'config',
  'calculator',
];

export default function ApiTestPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<TestResult[]>([
    { name: 'Autenticação (Token)', endpoint: 'GET /api/auth/me', status: 'pending' },
    { name: 'Configuração Calculadora', endpoint: 'GET /api/calculator/config', status: 'pending' },
    { name: 'Listar Propostas', endpoint: 'GET /api/calculator/proposal', status: 'pending' },
    { name: 'Buscar Proposta por ID', endpoint: 'GET /api/calculator/proposal/{id}', status: 'pending' },
    { name: 'Listar Usuários', endpoint: 'GET /api/user', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [proposalIdTest, setProposalIdTest] = useState('');
  const [localStorageAudit, setLocalStorageAudit] = useState<LocalStorageAudit[]>([]);
  const [hasLocalStorageIssues, setHasLocalStorageIssues] = useState(false);

  // Check if user is admin
  const session = authService.getSession();
  const isAdmin = session?.role === 'admin' || (session?.level ?? 0) >= 1000;

  // Audit localStorage on mount
  useEffect(() => {
    auditLocalStorage();
  }, []);

  const auditLocalStorage = () => {
    const audit: LocalStorageAudit[] = [];
    let hasIssues = false;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const value = localStorage.getItem(key) || '';
      const size = new Blob([value]).size;

      // Check if key matches forbidden patterns
      const isForbidden = FORBIDDEN_PATTERNS.some(pattern => 
        key.toLowerCase().includes(pattern) && !ALLOWED_KEYS.includes(key)
      );

      if (isForbidden) {
        hasIssues = true;
        audit.push({
          key,
          type: 'forbidden',
          reason: 'Dados de negócio não devem estar no localStorage',
          size,
        });
      } else if (ALLOWED_KEYS.includes(key) || key.startsWith('open_')) {
        audit.push({
          key,
          type: 'allowed',
          reason: 'Preferência de UI ou token de autenticação',
          size,
        });
      }
    }

    setLocalStorageAudit(audit);
    setHasLocalStorageIssues(hasIssues);
  };

  const updateResult = (index: number, update: Partial<TestResult>) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, ...update } : r));
  };

  const runTests = async () => {
    setIsRunning(true);
    
    // Reset all to pending
    setResults(prev => prev.map(r => ({ ...r, status: 'pending', message: undefined, data: undefined, responseTime: undefined })));

    // Test 1: Auth/Me
    updateResult(0, { status: 'loading' });
    const startAuth = performance.now();
    try {
      const token = openApi.getToken();
      if (!token) {
        updateResult(0, { 
          status: 'warning', 
          message: 'Nenhum token encontrado. Faça login para testar autenticação.',
          responseTime: performance.now() - startAuth,
        });
      } else {
        const user = await openApi.getCurrentUser();
        updateResult(0, { 
          status: 'success', 
          message: `Autenticado como: ${user.name} (${user.email})`,
          data: { id: user.id, name: user.name, email: user.email, level: user.level },
          responseTime: performance.now() - startAuth,
        });
      }
    } catch (error: any) {
      const status = error.response?.status;
      updateResult(0, { 
        status: status === 401 ? 'warning' : 'error', 
        message: status === 401 ? 'Token inválido ou expirado (401)' : `Erro: ${error.message}`,
        data: { status },
        responseTime: performance.now() - startAuth,
      });
    }

    // Test 2: Calculator Config
    updateResult(1, { status: 'loading' });
    const startConfig = performance.now();
    try {
      const config = await openApi.getCalculatorConfig();
      const hasVmPrices = config.vm_prices_brl?.vcpu > 0;
      updateResult(1, { 
        status: hasVmPrices ? 'success' : 'warning',
        message: hasVmPrices 
          ? `Config carregada: FX=${config.fx_default}, vCPU=R$${config.vm_prices_brl.vcpu}`
          : 'Config carregada mas sem preços de VM',
        data: {
          fx_default: config.fx_default,
          vm_prices_brl: config.vm_prices_brl,
          gpu_count: Object.keys(config.gpu_usd || {}).length,
          baremetal_cpus: config.baremetal?.cpu_models?.length || 0,
        },
        responseTime: performance.now() - startConfig,
      });
    } catch (error: any) {
      updateResult(1, { 
        status: 'error', 
        message: `Erro ao carregar config: ${error.response?.status || error.message}`,
        data: error.response?.data,
        responseTime: performance.now() - startConfig,
      });
    }

    // Test 3: List Proposals
    updateResult(2, { status: 'loading' });
    const startProposals = performance.now();
    try {
      const proposals = await openApi.getProposals({ __perPage: 10 });
      const count = proposals.total || 0;
      updateResult(2, { 
        status: 'success', 
        message: `${count} proposta(s) encontrada(s)`,
        data: { 
          total: count, 
          sample: (proposals.data as any[])?.slice(0, 3).map((p: any) => ({ 
            id: p.id, 
            name: p.name, 
            total: p.total 
          })) 
        },
        responseTime: performance.now() - startProposals,
      });
    } catch (error: any) {
      const status = error.response?.status;
      updateResult(2, { 
        status: status === 401 ? 'warning' : 'error', 
        message: status === 401 ? 'Requer autenticação (401)' : `Erro: ${error.message}`,
        data: { status },
        responseTime: performance.now() - startProposals,
      });
    }

    // Test 4: Get Proposal by ID
    updateResult(3, { status: 'loading' });
    const startProposalId = performance.now();
    try {
      const idToTest = proposalIdTest || '1';
      const numericId = parseInt(idToTest.replace('PROP-', ''), 10);
      
      if (isNaN(numericId)) {
        updateResult(3, { 
          status: 'warning', 
          message: 'ID inválido. Use um número ou PROP-{id}.',
          responseTime: performance.now() - startProposalId,
        });
      } else {
        const proposal = await openApi.getProposal(numericId);
        if (proposal) {
          const p = proposal as any;
          const hasItems = (p.servers?.length || 0) > 0;
          updateResult(3, { 
            status: hasItems ? 'success' : 'warning',
            message: hasItems 
              ? `Proposta ${p.id}: ${p.name} - R$ ${p.total}` 
              : `Proposta ${p.id} carregada mas SEM ITENS (servers)`,
            data: { 
              id: p.id, 
              name: p.name, 
              total: p.total,
              servers_count: p.servers?.length || 0,
              addons_count: p.addons?.length || 0,
            },
            responseTime: performance.now() - startProposalId,
          });
        } else {
          updateResult(3, { 
            status: 'warning', 
            message: `Proposta ID ${numericId} não encontrada`,
            responseTime: performance.now() - startProposalId,
          });
        }
      }
    } catch (error: any) {
      const status = error.response?.status;
      updateResult(3, { 
        status: status === 404 ? 'warning' : 'error', 
        message: status === 404 ? 'Proposta não encontrada (404)' : `Erro: ${error.message}`,
        data: { status },
        responseTime: performance.now() - startProposalId,
      });
    }

    // Test 5: List Users
    updateResult(4, { status: 'loading' });
    const startUsers = performance.now();
    try {
      const users = await openApi.getUsers({ __perPage: 5 });
      updateResult(4, { 
        status: 'success', 
        message: `${users.total || 0} usuário(s) encontrado(s)`,
        data: { 
          total: users.total,
          sample: users.data?.slice(0, 3).map(u => ({ id: u.id, name: u.name, level: u.level }))
        },
        responseTime: performance.now() - startUsers,
      });
    } catch (error: any) {
      const status = error.response?.status;
      updateResult(4, { 
        status: status === 401 ? 'warning' : 'error', 
        message: status === 401 ? 'Requer autenticação (401)' : `Erro: ${error.message}`,
        data: { status },
        responseTime: performance.now() - startUsers,
      });
    }

    // Re-audit localStorage after tests
    auditLocalStorage();
    
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'loading': return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'loading': return <Badge variant="secondary">Testando...</Badge>;
      case 'success': return <Badge className="bg-green-500">OK</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Atenção</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="outline">Pendente</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-6">Esta página é acessível apenas para administradores.</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔧 Diagnóstico API</h1>
          <p className="text-muted-foreground">Validação de endpoints e auditoria de persistência</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* LocalStorage Audit Alert */}
      {hasLocalStorageIssues && (
        <Card className="border-red-500 bg-red-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Dados de Negócio Detectados no localStorage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-4">
              Os seguintes dados NÃO deveriam estar armazenados localmente. Eles devem vir exclusivamente da API.
            </p>
            <div className="space-y-2">
              {localStorageAudit.filter(a => a.type === 'forbidden').map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-red-500/20 p-2 rounded">
                  <code className="font-mono">{item.key}</code>
                  <span className="text-muted-foreground">{(item.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Tests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Testes de Endpoints</CardTitle>
          <Button onClick={runTests} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Executar Testes
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Base URL: <code className="bg-muted px-2 py-1 rounded">https://apiv2.opendata.center/api</code>
          </p>

          {/* Proposal ID input for test 4 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">ID para teste de busca:</span>
            <Input
              placeholder="Ex: 1 ou PROP-1"
              value={proposalIdTest}
              onChange={(e) => setProposalIdTest(e.target.value)}
              className="w-40"
            />
          </div>

          {results.map((result, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <h3 className="font-medium">{result.name}</h3>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground">{result.endpoint}</code>
                      {result.responseTime && (
                        <span className="text-xs text-muted-foreground">
                          ({result.responseTime.toFixed(0)}ms)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {getStatusBadge(result.status)}
              </div>
              
              {result.message && (
                <p className={`text-sm mt-2 ${
                  result.status === 'error' ? 'text-red-600' : 
                  result.status === 'warning' ? 'text-yellow-600' : 
                  'text-muted-foreground'
                }`}>
                  {result.message}
                </p>
              )}
              
              {result.data && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Ver dados retornados
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* LocalStorage Audit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Auditoria localStorage
            {!hasLocalStorageIssues && <CheckCircle className="h-5 w-5 text-green-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localStorageAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item encontrado no localStorage.</p>
          ) : (
            <div className="space-y-2">
              {localStorageAudit.map((item, i) => (
                <div 
                  key={i} 
                  className={`flex items-center justify-between text-sm p-2 rounded ${
                    item.type === 'forbidden' ? 'bg-red-500/20' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.type === 'forbidden' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <code className="font-mono">{item.key}</code>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="text-xs">{item.reason}</span>
                    <span className="text-xs">{(item.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-500">
                {results.filter(r => r.status === 'success').length}
              </div>
              <div className="text-xs text-muted-foreground">Sucesso</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">
                {results.filter(r => r.status === 'warning').length}
              </div>
              <div className="text-xs text-muted-foreground">Atenção</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">
                {results.filter(r => r.status === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Erro</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted-foreground">
                {results.filter(r => r.status === 'pending').length}
              </div>
              <div className="text-xs text-muted-foreground">Pendente</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
