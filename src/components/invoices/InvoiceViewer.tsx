import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLicense } from '../../contexts/LicenseContext';
import { Invoice } from '../../contexts/DataContext';
import TemplateRenderer from '../templates/TemplateRenderer';
import ProTemplateModal from '../license/ProTemplateModal';
import { X, Download, Edit, Printer, FileText } from 'lucide-react';

// === NEW: PDF libs ===
import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';

interface InvoiceViewerProps {
  invoice: Invoice;
  onClose: () => void;
  onEdit: () => void;
  onDownload?: () => void;
}

type TemplateId = 'template1' | 'template2' | 'template3' | 'template4' | 'template5';
const TEMPLATE_LABELS: Record<TemplateId, string> = {
  template1: 'Classique',
  template2: 'Moderne',
  template3: 'Minimal',
  template4: 'Corporate (Pro)',
  template5: 'Premium (Pro)',
};
const PRO_TEMPLATES: TemplateId[] = ['template4', 'template5'];

/* ---------------------- Utils ---------------------- */

const fmtMoney = (v: number) =>
  `${(v ?? 0).toFixed(2)} MAD`;

const loadImageAsDataURL = async (url?: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export default function InvoiceViewer({ invoice, onClose, onEdit, onDownload }: InvoiceViewerProps) {
  const { user } = useAuth();
  const { isPro } = useLicense();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('template2');
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);
  const [showProModal, setShowProModal] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement>(null);

  const filename = useMemo(() => {
    const safeNumber = (invoice?.number || 'Facture').toString().replace(/[^\w\-]/g, '_');
    return `Facture_${safeNumber}.pdf`;
  }, [invoice?.number]);

  const trySelectTemplate = (tpl: TemplateId) => {
    if (PRO_TEMPLATES.includes(tpl) && !isPro) {
      setShowProModal(true);
      return;
    }
    setSelectedTemplate(tpl);
  };
  const getTemplateName = (id: TemplateId) => TEMPLATE_LABELS[id];

  /* ---------------------- PDF Export (jsPDF) ---------------------- */

  const drawHeader = (doc: jsPDF, logoDataUrl: string | null) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    // Bande noire
    doc.setFillColor(0, 0, 0);
    doc.rect(10, 10, pageWidth - 20, 22, 'F');

    // Logo
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 14, 12, 18, 18);
      } catch {/* ignore */}
    }

    // Titre société + type document (centre)
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const companyName = user?.company?.name || 'SOCIÉTÉ';
    doc.text(companyName, pageWidth / 2, 20, { align: 'center', baseline: 'middle' });
    doc.setFontSize(11);
    doc.text('FACTURE', pageWidth / 2, 28, { align: 'center', baseline: 'middle' });
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Bande noire pied
    doc.setFillColor(0, 0, 0);
    doc.rect(10, pageHeight - 20, pageWidth - 20, 12, 'F');

    // Texte entreprise
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const infos =
      `${user?.company?.name || ''} | ${user?.company?.address || ''} | Tél: ${user?.company?.phone || ''} | ` +
      `ICE: ${user?.company?.ice || ''} | IF: ${user?.company?.if || ''} | RC: ${user?.company?.rc || ''} | ` +
      `CNSS: ${user?.company?.cnss || ''} | Patente: ${user?.company?.patente || ''} | ` +
      `EMAIL: ${user?.company?.email || ''} | SITE WEB: ${user?.company?.website || ''}`;
    doc.text(infos, pageWidth / 2, pageHeight - 12, { align: 'center' });

    // Pagination
    doc.text(`Page ${pageNumber} / ${totalPages}`, pageWidth - 24, pageHeight - 12, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const handleDownload = async () => {
    if (onDownload) onDownload();

    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    // charger logo & signature (Data URL)
    const logoDataUrl = await loadImageAsDataURL(user?.company?.logo || undefined);
    const signDataUrl = includeSignature ? await loadImageAsDataURL(user?.company?.signature || undefined) : null;

    // didDrawPage => header + footer AUTO à chaque page
    let totalPagesExp = '{total_pages_count_string}';
    (autoTable as any).setDefaults({
      didDrawPage: (data: any) => {
        // Header
        drawHeader(doc, logoDataUrl);
        // Footer (on ne connaît pas encore le total de pages)
        const pageNumber = doc.internal.getNumberOfPages();
        drawFooter(doc, pageNumber, (totalPagesExp as unknown) as number);
        // Laisser 10 + 22 (header) + marge
      },
      margin: { top: 36, bottom: 24, left: 12, right: 12 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], halign: 'center' as const },
      bodyStyles: { halign: 'center' as const },
      tableLineWidth: 0.2,
    } as UserOptions);

    /* ---- Bloc infos client + facture ---- */
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);

    const leftBoxX = 12;
    const rightBoxX = pageWidth / 2 + 2;
    const boxY = 36; // sous l’entête
    const boxW = pageWidth / 2 - 14;
    const boxH = 28;

    // Boîte Client
    doc.roundedRect(leftBoxX, boxY, boxW, boxH, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`CLIENT : ${invoice?.client?.name || ''}`, leftBoxX + boxW / 2, boxY + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const clientLines = [
      invoice?.client?.address || '',
      invoice?.client?.city || '',
      invoice?.client?.ice ? `ICE: ${invoice.client.ice}` : '',
    ].filter(Boolean);
    clientLines.forEach((t, i) => {
      doc.text(t, leftBoxX + 4, boxY + 12 + i * 5);
    });

    // Boîte Facture
    doc.roundedRect(rightBoxX, boxY, boxW, boxH, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`DATE : ${new Date(invoice?.date || Date.now()).toLocaleDateString('fr-FR')}`, rightBoxX + boxW / 2, boxY + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`${invoice?.number ? 'FACTURE N° : ' + invoice.number : ''}`, rightBoxX + 4, boxY + 13);

    let cursorY = boxY + boxH + 6;

    /* ---- Tableau des lignes ---- */
    const head = [['DÉSIGNATION', 'QUANTITÉ', 'P.U. HT', 'TOTAL HT']];
    const body = (invoice?.items || []).map((it) => [
      it.description || '',
      `${(it.quantity ?? 0).toFixed(3)} ${it.unit || ''}`,
      fmtMoney(it.unitPrice ?? 0),
      fmtMoney(it.total ?? (it.unitPrice ?? 0) * (it.quantity ?? 0)),
    ]);

    autoTable(doc, {
      startY: cursorY,
      head,
      body,
      columnStyles: {
        0: { halign: 'left' },
      },
      didDrawPage: (data) => {
        // Cette callback est appelée sur chaque page du tableau,
        // mais notre header/footer sont déjà gérés par setDefaults(didDrawPage)
      },
    });

    const afterTableY = (doc as any).lastAutoTable.finalY || cursorY;

    /* ---- Totaux ---- */
    const leftW = (pageWidth - 24) * 0.52;
    const rightW = (pageWidth - 24) * 0.46;
    const leftX = 12;
    const rightX = 12 + leftW + 4;

    const vatGroups = (invoice?.items || []).reduce(
      (acc: Record<number, { amount: number; products: string[] }>, item) => {
        const vatRate = item.vatRate ?? 0;
        const vatAmount = ((item.unitPrice ?? 0) * (item.quantity ?? 0) * vatRate) / 100;
        if (!acc[vatRate]) acc[vatRate] = { amount: 0, products: [] };
        acc[vatRate].amount += vatAmount;
        acc[vatRate].products.push(item.description || '');
        return acc;
      },
      {}
    );

    let y = afterTableY + 6;
    // Bloc gauche: montant en lettres
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.roundedRect(leftX, y, leftW, 26, 2, 2);
    doc.text(`Arrêtée le présent facture à la somme de :`, leftX + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    const inWords = invoice?.totalInWords || '';
    doc.text(`• ${inWords}`, leftX + 3, y + 13);

    // Bloc droit: totaux & TVA
    doc.roundedRect(rightX, y, rightW, 26, 2, 2);
    let tY = y + 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Total HT :', rightX + 3, tY);
    doc.text(fmtMoney(invoice?.subtotal ?? 0), rightX + rightW - 3, tY, { align: 'right' });

    const rates = Object.keys(vatGroups);
    let tv = 0;
    rates.forEach((r, idx) => {
      tY += 6;
      const label = `TVA : ${r}%`;
      doc.text(label, rightX + 3, tY);
      doc.text(fmtMoney(vatGroups[+r].amount), rightX + rightW - 3, tY, { align: 'right' });
      tv += vatGroups[+r].amount;
    });

    tY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC :', rightX + 3, tY);
    doc.text(fmtMoney(invoice?.totalTTC ?? (invoice?.subtotal ?? 0) + tv), rightX + rightW - 3, tY, { align: 'right' });

    /* ---- Signature sur NOUVELLE PAGE (comme Word) ---- */
    if (includeSignature) {
      doc.addPage();
      // le header/footer seront redessinés automatiquement via didDrawPage
      // bloc signature
      const sigW = 60, sigH = 30;
      const px = 20, py = 60;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Signature', px, py - 6);
      doc.rect(px, py, sigW, sigH);
      if (signDataUrl) {
        try {
          doc.addImage(signDataUrl, 'PNG', px + 2, py + 2, sigW - 4, sigH - 4);
        } catch {/* ignore */}
      }
    }

    // Pagination finale (remplacement du token)
    // @ts-ignore
    if (typeof doc.putTotalPages === 'function') {
      // @ts-ignore
      doc.putTotalPages(totalPagesExp);
    }

    doc.save(filename);
  };

  const handlePrint = async () => {
    // même PDF mais impression auto
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoDataUrl = await loadImageAsDataURL(user?.company?.logo || undefined);
    const signDataUrl = includeSignature ? await loadImageAsDataURL(user?.company?.signature || undefined) : null;

    let totalPagesExp = '{total_pages_count_string}';
    (autoTable as any).setDefaults({
      didDrawPage: () => {
        drawHeader(doc, logoDataUrl);
        const pageNumber = doc.internal.getNumberOfPages();
        drawFooter(doc, pageNumber, (totalPagesExp as unknown) as number);
      },
      margin: { top: 36, bottom: 24, left: 12, right: 12 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], halign: 'center' as const },
      bodyStyles: { halign: 'center' as const },
      tableLineWidth: 0.2,
    } as UserOptions);

    // (Même contenu que handleDownload, résumé ici pour concision)
    const leftBoxX = 12;
    const rightBoxX = pageWidth / 2 + 2;
    const boxY = 36;
    const boxW = pageWidth / 2 - 14;
    const boxH = 28;

    doc.roundedRect(leftBoxX, boxY, boxW, boxH, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`CLIENT : ${invoice?.client?.name || ''}`, leftBoxX + boxW / 2, boxY + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const clientLines = [
      invoice?.client?.address || '',
      invoice?.client?.city || '',
      invoice?.client?.ice ? `ICE: ${invoice.client.ice}` : '',
    ].filter(Boolean);
    clientLines.forEach((t, i) => doc.text(t, leftBoxX + 4, boxY + 12 + i * 5));

    doc.roundedRect(rightBoxX, boxY, boxW, boxH, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`DATE : ${new Date(invoice?.date || Date.now()).toLocaleDateString('fr-FR')}`, rightBoxX + boxW / 2, boxY + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`${invoice?.number ? 'FACTURE N° : ' + invoice.number : ''}`, rightBoxX + 4, boxY + 13);

    let cursorY = boxY + boxH + 6;

    const head = [['DÉSIGNATION', 'QUANTITÉ', 'P.U. HT', 'TOTAL HT']];
    const body = (invoice?.items || []).map((it) => [
      it.description || '',
      `${(it.quantity ?? 0).toFixed(3)} ${it.unit || ''}`,
      fmtMoney(it.unitPrice ?? 0),
      fmtMoney(it.total ?? (it.unitPrice ?? 0) * (it.quantity ?? 0)),
    ]);

    autoTable(doc, { startY: cursorY, head, body, columnStyles: { 0: { halign: 'left' } } });

    const afterTableY = (doc as any).lastAutoTable.finalY || cursorY;

    const leftW = (pageWidth - 24) * 0.52;
    const rightW = (pageWidth - 24) * 0.46;
    const leftX = 12;
    const rightX = 12 + leftW + 4;

    const vatGroups = (invoice?.items || []).reduce(
      (acc: Record<number, { amount: number; products: string[] }>, item) => {
        const vr = item.vatRate ?? 0;
        const va = ((item.unitPrice ?? 0) * (item.quantity ?? 0) * vr) / 100;
        if (!acc[vr]) acc[vr] = { amount: 0, products: [] };
        acc[vr].amount += va;
        acc[vr].products.push(item.description || '');
        return acc;
      },
      {}
    );

    let y = afterTableY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.roundedRect(leftX, y, leftW, 26, 2, 2);
    doc.text(`Arrêtée le présent facture à la somme de :`, leftX + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`• ${invoice?.totalInWords || ''}`, leftX + 3, y + 13);

    doc.roundedRect(rightX, y, rightW, 26, 2, 2);
    let tY = y + 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Total HT :', rightX + 3, tY);
    doc.text(fmtMoney(invoice?.subtotal ?? 0), rightX + rightW - 3, tY, { align: 'right' });

    const rates = Object.keys(vatGroups);
    let tv = 0;
    rates.forEach((r) => {
      tY += 6;
      doc.text(`TVA : ${r}%`, rightX + 3, tY);
      doc.text(fmtMoney(vatGroups[+r].amount), rightX + rightW - 3, tY, { align: 'right' });
      tv += vatGroups[+r].amount;
    });

    tY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC :', rightX + 3, tY);
    doc.text(fmtMoney(invoice?.totalTTC ?? (invoice?.subtotal ?? 0) + tv), rightX + rightW - 3, tY, { align: 'right' });

    if (includeSignature) {
      doc.addPage();
      const sigW = 60, sigH = 30;
      const px = 20, py = 60;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Signature', px, py - 6);
      doc.rect(px, py, sigW, sigH);
      if (signDataUrl) {
        try {
          doc.addImage(signDataUrl, 'PNG', px + 2, py + 2, sigW - 4, sigH - 4);
        } catch {}
      }
    }

    // @ts-ignore
    if (typeof doc.putTotalPages === 'function') {
      // @ts-ignore
      doc.putTotalPages('{total_pages_count_string}');
    }
    // @ts-ignore jsPDF
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  };

  /* ---------------------- UI ---------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-[1100px] max-h-[92vh] overflow-hidden flex flex-col">
        {/* Barre d’actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h2 className="text-lg font-semibold">
              Aperçu {invoice?.number ? `– ${invoice.number}` : ''} ({getTemplateName(selectedTemplate)})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => trySelectTemplate(e.target.value as TemplateId)}
              className="border rounded px-2 py-1 text-sm"
              title="Choisir un modèle (pour l’aperçu à l’écran)"
            >
              {Object.entries(TEMPLATE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm ml-2">
              <input
                type="checkbox"
                checked={includeSignature}
                onChange={(e) => setIncludeSignature(e.target.checked)}
              />
              Inclure la signature
            </label>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-gray-50"
              title="Imprimer"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border bg-black text-white hover:opacity-90"
              title="Télécharger PDF"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>

            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-gray-50"
              title="Modifier"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </button>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-gray-50"
              title="Fermer"
            >
              <X className="w-4 h-4" />
              Fermer
            </button>
          </div>
        </div>

        {/* Zone d’aperçu à l’écran (vos templates visuels actuels) */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div ref={contentRef} className="mx-auto">
            <TemplateRenderer
              templateId={selectedTemplate}
              data={invoice}
              type="invoice"
              includeSignature={includeSignature}
            />
          </div>
        </div>

        {/* Modal modèles Pro */}
        {showProModal && (
          <ProTemplateModal
            isOpen={showProModal}
            onClose={() => setShowProModal(false)}
            templateName={getTemplateName(selectedTemplate)}
          />
        )}
      </div>
    </div>
  );
}
