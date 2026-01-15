import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

export function generateApiDocumentationPdf() {
  const docDefinition: any = {
    content: [
      { text: 'Documentação: Configuração de Preços - API', style: 'header' },
      { text: 'Arquitetura de Comunicação com a API', style: 'subheader', margin: [0, 20, 0, 10] },
      
      { text: 'Visão Geral', style: 'sectionHeader' },
      { 
        text: 'A comunicação com a API na página de Configuração de Preços segue uma arquitetura em camadas:',
        margin: [0, 5, 0, 10]
      },
      {
        ul: [
          'Precos.tsx (UI) → useConfigPersistence (Estado/Lógica) → calculatorConfigService (Cliente HTTP) → API REST /calculator/config'
        ],
        margin: [0, 0, 0, 15]
      },

      { text: '1. Camada de UI (Precos.tsx)', style: 'sectionHeader' },
      { text: 'Responsabilidades:', bold: true, margin: [0, 5, 0, 5] },
      {
        ul: [
          'Exibe inputs para editar preços',
          'Chama updateConfig() para atualizar estado local',
          'Chama saveToApi() para persistir no servidor'
        ],
        margin: [0, 0, 0, 15]
      },

      { text: '2. Camada de Estado/Lógica (useConfigPersistence.ts)', style: 'sectionHeader' },
      { text: 'Responsabilidades:', bold: true, margin: [0, 5, 0, 5] },
      {
        ul: [
          'Mantém localConfig (estado editável)',
          'Converte config ↔ payload da API',
          'Gerencia salvamento (POST/PUT)'
        ],
        margin: [0, 0, 0, 15]
      },

      { text: '3. Camada de Busca (useConfig.ts)', style: 'sectionHeader' },
      { text: 'Responsabilidades:', bold: true, margin: [0, 5, 0, 5] },
      {
        ul: [
          'Usa react-query para carregar config inicial',
          'Chama openApi.getCalculatorConfig()'
        ],
        margin: [0, 0, 0, 15]
      },

      { text: '4. Camada de Transformação (openApi.ts)', style: 'sectionHeader' },
      { text: 'Função parseConfigItems():', bold: true, margin: [0, 5, 0, 5] },
      {
        ul: [
          'Converte resposta da API em objeto CalculatorConfig',
          'Mapeia category/section para estrutura hierárquica'
        ],
        margin: [0, 0, 0, 15]
      },

      { text: '5. Camada HTTP (calculatorConfigService.ts)', style: 'sectionHeader' },
      { text: 'Endpoints utilizados:', bold: true, margin: [0, 5, 0, 5] },
      {
        ul: [
          'GET /api/calculator/config?__limit=100 - Lista configurações',
          'POST /api/calculator/config - Cria nova entrada',
          'PUT /api/calculator/config/{id} - Atualiza entrada existente'
        ],
        margin: [0, 0, 0, 20]
      },

      { text: 'Fluxo de Leitura (ao abrir a página)', style: 'subheader', margin: [0, 10, 0, 10] },
      {
        ol: [
          'useConfig chama openApi.getCalculatorConfig()',
          'openApi faz GET /calculator/config?__limit=100',
          'parseConfigItems() converte resposta paginada em CalculatorConfig',
          'useConfigPersistence inicializa localConfig com apiConfig'
        ],
        margin: [0, 0, 0, 20]
      },

      { text: 'Fluxo de Escrita (ao clicar "Salvar Preços")', style: 'subheader', margin: [0, 10, 0, 10] },
      {
        ol: [
          'saveToApi() é chamado em useConfigPersistence',
          'configToApiPayloads(localConfig) gera array de payloads',
          'Para cada payload: Se existe ID → PUT, senão → POST',
          'Após sucesso: invalidateQueries + refetch sincroniza UI'
        ],
        margin: [0, 0, 0, 20]
      },

      { text: 'Formato do Payload', style: 'subheader', margin: [0, 10, 0, 10] },
      { text: 'Exemplo de payload enviado para a API:', margin: [0, 5, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [{ text: 'Campo', bold: true }, { text: 'Exemplo', bold: true }],
            ['category', 'GPU'],
            ['section', 'Preços'],
            ['config', '[{"label": "NVIDIA T4", "by": "unit", "type": "USD", "value": 475}]']
          ]
        },
        margin: [0, 0, 0, 20]
      },

      { text: 'Observações Importantes', style: 'subheader', margin: [0, 10, 0, 10] },
      {
        ul: [
          'O campo "value" é usado (não "price") para valores numéricos',
          'Cada category/section gera uma entrada separada na API',
          'IDs são rastreados para determinar POST vs PUT',
          'react-query gerencia cache e revalidação automática'
        ]
      }
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        color: '#1a365d'
      },
      subheader: {
        fontSize: 16,
        bold: true,
        color: '#2d3748'
      },
      sectionHeader: {
        fontSize: 13,
        bold: true,
        color: '#4a5568',
        margin: [0, 10, 0, 5]
      }
    },
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.3
    },
    footer: function(currentPage: number, pageCount: number) {
      return {
        text: `Página ${currentPage} de ${pageCount} | Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
        alignment: 'center',
        fontSize: 9,
        margin: [0, 10, 0, 0]
      };
    }
  };

  pdfMake.createPdf(docDefinition).download('documentacao-api-precos.pdf');
}
