import { ClientInfo, ProposalMeta, CalculationResult, ResellerState, formatCurrency, getValidityDate } from './calculatorConfig';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { PDFDocument, PageSizes } from 'pdf-lib';
import { NormalizedAttachment } from '@/services/attachmentsService';

// @ts-ignore
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

// OPEN Calculator PDF Generator
interface OpenPDFParams {
  client: ClientInfo;
  proposal: ProposalMeta;
  result: CalculationResult;
  selectedTerm: string;
  datacenter?: string;
  reseller?: ResellerState;
  includeCommission?: boolean;
  observacao?: string;
  attachments?: NormalizedAttachment[];
}

// Generate summary page as PDF bytes using pdfMake
const generateSummaryPdfBytes = (params: OpenPDFParams): Promise<Uint8Array> => {
  const { client, proposal, result, selectedTerm, datacenter = 'SP1', reseller, includeCommission = true, observacao } = params;
  const validUntil = getValidityDate(proposal.createdAt, proposal.validityDays);
  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');
  const isPartnerMode = reseller?.viewMode === 'INTERNO';
  const showCommission = includeCommission && reseller && result.overValue > 0;

  const body: any[] = [
    [
      { text: 'Itens', style: 'th' },
      { text: 'Qt', style: 'th', alignment: 'center' },
      { text: 'Valor Unitário (R$)', style: 'th', alignment: 'right' },
      { text: 'Valor Total (R$)', style: 'th', alignment: 'right' },
    ],
  ];

  result.rows.forEach((row) => {
    // Use finalTotal (with markup) if available, otherwise fallback to subtotal
    const displayTotal = row.finalTotal ?? row.subtotal;
    body.push([
      { text: row.label, style: 'td' },
      { text: String(row.qty), style: 'td', alignment: 'center' },
      { text: formatCurrency(row.unitPrice), style: 'td', alignment: 'right' },
      { text: formatCurrency(displayTotal), style: 'td', alignment: 'right' },
    ]);
  });

  // Add separator and subtotals section
  body.push([{ text: '', colSpan: 4, margin: [0, 8, 0, 0] }, {}, {}, {}]);
  
  // Detailed breakdown section
  body.push([{ text: 'RESUMO DETALHADO', colSpan: 4, style: 'sectionHeader', alignment: 'left' }, {}, {}, {}]);
  body.push([{ text: '', colSpan: 4, margin: [0, 4, 0, 0] }, {}, {}, {}]);
  
  body.push([{ text: 'Subtotal Recursos (CPU, RAM, Disco)', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: formatCurrency(result.subRec), style: 'tdBold', alignment: 'right' }]);
  body.push([{ text: 'Subtotal IPs Públicos', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: formatCurrency(result.subIps), style: 'tdBold', alignment: 'right' }]);
  body.push([{ text: 'Subtotal Serviços Adicionais', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: formatCurrency(result.subServices), style: 'tdBold', alignment: 'right' }]);
  body.push([{ text: 'Subtotal Backup (retenção)', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: formatCurrency(result.subBackup), style: 'tdBold', alignment: 'right' }]);
  
  if (result.subKubernetes > 0) {
    body.push([{ text: 'Subtotal Kubernetes Gerenciado', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: formatCurrency(result.subKubernetes), style: 'tdBold', alignment: 'right' }]);
  }
  
  if (result.subStorage > 0) {
    body.push([{ text: 'Subtotal Storage', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: formatCurrency(result.subStorage), style: 'tdBold', alignment: 'right' }]);
  }
  
  body.push([{ text: '', colSpan: 4, margin: [0, 4, 0, 0] }, {}, {}, {}]);
  body.push([{ text: 'Desconto por Vigência', colSpan: 3, style: 'tdBold', alignment: 'right' }, {}, {}, { text: `-${formatCurrency(result.discountValue)}`, style: 'tdBold', alignment: 'right', color: '#d9534f' }]);
  body.push([{ text: `Vigência: ${selectedTerm} ${parseInt(selectedTerm) === 1 ? 'mês' : 'meses'}`, colSpan: 2, style: 'tdBold', alignment: 'left' }, {}, { text: `Datacenter: ${datacenter}`, colSpan: 2, style: 'tdBold', alignment: 'left' }, {}]);
  body.push([{ text: 'TOTAL MENSAL', colSpan: 3, style: 'totalRow', alignment: 'right' }, {}, {}, { text: formatCurrency(result.grandTotal), style: 'totalRow', alignment: 'right' }]);

  // Add Commission/Partner info when commission exists (for PARTNER mode or when printing with commission)
  if (showCommission) {
    body.push([{ text: '', colSpan: 4, margin: [0, 8, 0, 0] }, {}, {}, {}]);
    body.push([{ text: isPartnerMode ? 'INFORMAÇÕES DO PARCEIRO (Canal/Parceiro)' : 'COMISSÃO DO PARCEIRO', colSpan: 4, style: 'sectionHeader', alignment: 'left' }, {}, {}, {}]);
    body.push([{ text: '', colSpan: 4, margin: [0, 4, 0, 0] }, {}, {}, {}]);
    
    if (reseller.resellerName) {
      body.push([{ text: `Parceiro: ${reseller.resellerName}`, colSpan: 4, style: 'td', alignment: 'left' }, {}, {}, {}]);
    }
    body.push([{ text: `Comissão (%): ${result.overPercent.toFixed(1)}%`, colSpan: 2, style: 'tdBold', alignment: 'left' }, {}, { text: `Comissão (R$): ${formatCurrency(result.overValue)}`, colSpan: 2, style: 'tdBold', alignment: 'left' }, {}]);
    body.push([{ text: `Total com Comissão: R$ ${formatCurrency(result.totalWithOver)}`, colSpan: 4, style: 'totalRow', alignment: 'left' }, {}, {}, {}]);
    
    // Approval info (only in partner mode)
    if (isPartnerMode && reseller.approvalRequired) {
      body.push([{ text: '', colSpan: 4, margin: [0, 4, 0, 0] }, {}, {}, {}]);
      if (reseller.approvalStatus === 'Aprovado') {
        body.push([{ text: `Aprovação: ${reseller.approvalStatus}`, colSpan: 2, style: 'tdBold', alignment: 'left', color: '#16a34a' }, {}, { text: `Aprovador: ${reseller.approver}`, colSpan: 2, style: 'td', alignment: 'left' }, {}]);
        if (reseller.approvedAt) {
          const approvedDate = new Date(reseller.approvedAt);
          body.push([{ text: `Aprovado em: ${approvedDate.toLocaleString('pt-BR')}`, colSpan: 4, style: 'td', alignment: 'left' }, {}, {}, {}]);
        }
      } else {
        body.push([{ text: 'Aprovação pendente (Comissão acima de 20%)', colSpan: 4, style: 'tdBold', alignment: 'left', color: '#dc2626' }, {}, {}, {}]);
      }
    }
    
    if (isPartnerMode && reseller.overReason) {
      body.push([{ text: `Motivo da Comissão: ${reseller.overReason}`, colSpan: 4, style: 'td', alignment: 'left' }, {}, {}, {}]);
    }
    if (isPartnerMode && reseller.observations) {
      body.push([{ text: `Observações: ${reseller.observations}`, colSpan: 4, style: 'td', alignment: 'left' }, {}, {}, {}]);
    }
  }

  // Add Observações section at the end (only if not empty)
  if (observacao && observacao.trim()) {
    body.push([{ text: '', colSpan: 4, margin: [0, 8, 0, 0] }, {}, {}, {}]);
    body.push([{ text: 'OBSERVAÇÕES', colSpan: 4, style: 'sectionHeader', alignment: 'left' }, {}, {}, {}]);
    body.push([{ text: '', colSpan: 4, margin: [0, 4, 0, 0] }, {}, {}, {}]);
    body.push([{ text: observacao.trim(), colSpan: 4, style: 'td', alignment: 'left' }, {}, {}, {}]);
  }

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [25, 30, 25, 30],
    content: [
      { text: 'OPEN — Proposta Comercial', style: 'h1', alignment: 'center' },
      { text: 'Resumo de Preços', style: 'h2', alignment: 'center', margin: [0, 0, 0, 14] },
      {
        columns: [
          { text: `Cliente: ${client.name || '-'}`, style: 'meta', width: '*' },
          { text: `Empresa: ${client.company || '-'}`, style: 'meta', width: '*' },
          { text: `E-mail: ${client.email || '-'}`, style: 'meta', width: '*' },
          { text: `Telefone: ${client.phone || '-'}`, style: 'meta', width: '*' },
        ],
        margin: [0, 0, 0, 6]
      },
      {
        columns: [
          { text: `Proposta: ${proposal.id}`, style: 'meta', width: '*' },
          { text: `Validade: ${fmtDate(validUntil)}`, style: 'meta', width: '*' },
          { text: `Vigência: ${selectedTerm} ${parseInt(selectedTerm) === 1 ? 'mês' : 'meses'}`, style: 'meta', width: '*' },
          { text: `Datacenter: ${datacenter}`, style: 'meta', width: '*' },
        ],
        margin: [0, 0, 0, 14]
      },
      {
        table: { 
          headerRows: 1, 
          widths: ['*', 60, 120, 120], 
          body 
        },
        layout: {
          fillColor: (i: number) => (i === 0 ? '#1e3a5f' : (i % 2 === 0 ? '#f8fafc' : null)),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1',
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
      },
    ],
    styles: {
      h1: { fontSize: 22, bold: true, color: '#1e3a5f', margin: [0, 0, 0, 4] },
      h2: { fontSize: 14, color: '#374151', margin: [0, 0, 0, 0] },
      meta: { fontSize: 11, color: '#374151' },
      th: { fontSize: 11, bold: true, color: '#ffffff' },
      td: { fontSize: 10, color: '#1f2937' },
      tdBold: { fontSize: 10, bold: true, color: '#1e3a5f' },
      sectionHeader: { fontSize: 11, bold: true, color: '#1e3a5f', margin: [0, 8, 0, 4] },
      totalRow: { fontSize: 12, bold: true, color: '#1e3a5f' },
      footer: { fontSize: 10, color: '#6b7280', italics: true },
    },
    defaultStyle: { fontSize: 10 },
  };

  return new Promise((resolve, reject) => {
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBuffer((buffer: Buffer) => {
      resolve(new Uint8Array(buffer));
    });
  });
};

// Fetch the template PDF from public folder
const fetchTemplatePdf = async (): Promise<Uint8Array> => {
  const response = await fetch('/proposta_modelo_OPEN.pdf');
  if (!response.ok) {
    throw new Error('Failed to load PDF template');
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

// Fetch attachment as bytes
const fetchAttachment = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

// Convert image to PDF page
const imageToPage = async (pdfDoc: PDFDocument, imageBytes: Uint8Array, mime: string): Promise<void> => {
  let image;
  
  if (mime === 'image/png') {
    image = await pdfDoc.embedPng(imageBytes);
  } else if (mime === 'image/jpeg' || mime === 'image/jpg') {
    image = await pdfDoc.embedJpg(imageBytes);
  } else {
    throw new Error(`Unsupported image type: ${mime}`);
  }
  
  // Calculate dimensions to fit A4 with margins
  const A4_WIDTH = PageSizes.A4[0];
  const A4_HEIGHT = PageSizes.A4[1];
  const MARGIN = 40;
  
  const maxWidth = A4_WIDTH - (MARGIN * 2);
  const maxHeight = A4_HEIGHT - (MARGIN * 2);
  
  let imgWidth = image.width;
  let imgHeight = image.height;
  
  // Scale to fit within margins
  const widthRatio = maxWidth / imgWidth;
  const heightRatio = maxHeight / imgHeight;
  const scale = Math.min(widthRatio, heightRatio, 1); // Don't upscale
  
  imgWidth = imgWidth * scale;
  imgHeight = imgHeight * scale;
  
  // Center on page
  const x = (A4_WIDTH - imgWidth) / 2;
  const y = (A4_HEIGHT - imgHeight) / 2;
  
  const page = pdfDoc.addPage(PageSizes.A4);
  page.drawImage(image, {
    x,
    y,
    width: imgWidth,
    height: imgHeight,
  });
};

// Merge template PDF with summary PDF and attachments
export const generateOpenPDF = async ({ 
  client, 
  proposal, 
  result, 
  selectedTerm, 
  datacenter,
  reseller, 
  includeCommission,
  observacao,
  attachments = [],
}: OpenPDFParams): Promise<void> => {
  try {
    // Generate summary PDF bytes
    const summaryPdfBytes = await generateSummaryPdfBytes({ 
      client, 
      proposal, 
      result, 
      selectedTerm, 
      datacenter,
      reseller, 
      includeCommission,
      observacao,
    });
    
    // Load template PDF
    let templatePdfBytes: Uint8Array;
    try {
      templatePdfBytes = await fetchTemplatePdf();
    } catch (error) {
      console.warn('Template PDF not found, generating summary only');
      templatePdfBytes = new Uint8Array(0);
    }

    // Create merged PDF document
    const mergedPdf = await PDFDocument.create();

    // Copy template pages if available
    if (templatePdfBytes.length > 0) {
      const templatePdf = await PDFDocument.load(templatePdfBytes);
      const templatePages = await mergedPdf.copyPages(templatePdf, templatePdf.getPageIndices());
      templatePages.forEach((page) => mergedPdf.addPage(page));
    }

    // Copy summary pages
    const summaryPdf = await PDFDocument.load(summaryPdfBytes);
    const summaryPages = await mergedPdf.copyPages(summaryPdf, summaryPdf.getPageIndices());
    summaryPages.forEach((page) => mergedPdf.addPage(page));

    // Append attachments at the end (sorted by order)
    const sortedAttachments = [...attachments];
    
    for (const attachment of sortedAttachments) {
      try {
        const attachmentBytes = await fetchAttachment(attachment.url);
        
        if (attachment.mime === 'application/pdf') {
          // For PDFs, merge all pages
          const attachmentPdf = await PDFDocument.load(attachmentBytes);
          const attachmentPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
          attachmentPages.forEach((page) => mergedPdf.addPage(page));
        } else if (attachment.mime.startsWith('image/')) {
          // For images, convert to PDF page
          await imageToPage(mergedPdf, attachmentBytes, attachment.mime);
        }
      } catch (attachError) {
        console.error(`Error processing attachment ${attachment.name}:`, attachError);
        // Continue with other attachments
      }
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Download the merged PDF
    const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OPEN_proposta_${proposal.id.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
