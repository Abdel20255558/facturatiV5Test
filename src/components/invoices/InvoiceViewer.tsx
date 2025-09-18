import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLicense } from '../../contexts/LicenseContext';
import { Invoice } from '../../contexts/DataContext';
import TemplateRenderer from '../templates/TemplateRenderer';
import ProTemplateModal from '../license/ProTemplateModal';
import { X, Download, Edit, Printer, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';

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

export default function InvoiceViewer({ invoice, onClose, onEdit, onDownload }: InvoiceViewerProps) {
  const { user } = useAuth();
  const { isPro } = useLicense();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('template2');
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);
  const [showProModal, setShowProModal] = useState<boolean>(false);

  // 👉 Le template paginé (avec .pdf-page / .html2pdf__page-break) est rendu dans ce conteneur
  const contentRef = useRef<HTMLDivElement>(null);

  const filename = useMemo(() => {
    const safe = (invoice?.number || 'Facture').toString().replace(/[^\w\-]/g, '_');
    return `Facture_${safe}.pdf`;
  }, [invoice?.number]);

  // 👉 Options html2pdf : respect des sauts CSS, pas de taille forcée
  const html2pdfOptions = useMemo(() => {
    return {
      margin: [5, 5, 5, 5],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css'] as const }, // respecte .html2pdf__page-break & avoid rules
    };
  }, [filename]);

  const handleDownload = async () => {
    if (onDownload) onDownload();
    if (!contentRef.current) return;
    await html2pdf().from(contentRef.current).set(html2pdfOptions).save();
  };

  const handlePrint = async () => {
    if (!contentRef.current) return;
    const worker = html2pdf().from(contentRef.current).set(html2pdfOptions).toPdf();
    const pdf = await worker.get('pdf');
    // @ts-ignore jsPDF
    pdf.autoPrint();
    const blobUrl = pdf.output('bloburl');
    const win = window.open(blobUrl, '_blank');
    if (!win) await worker.save(); // fallback si popup bloquée
  };

  const trySelectTemplate = (tpl: TemplateId) => {
    if (PRO_TEMPLATES.includes(tpl) && !isPro) {
      setShowProModal(true);
      return;
    }
    setSelectedTemplate(tpl);
  };

  const getTemplateName = (id: TemplateId) => TEMPLATE_LABELS[id];

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
            {/* Choix du modèle (affichage écran) */}
            <select
              value={selectedTemplate}
              onChange={(e) => trySelectTemplate(e.target.value as TemplateId)}
              className="border rounded px-2 py-1 text-sm"
              title="Choisir un modèle"
            >
              {Object.entries(TEMPLATE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>

            {/* Inclure/Retirer la signature (le template gère la page dédiée) */}
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

        {/* Aperçu défilant — le template rend plusieurs “.pdf-page” avec header/pied répétés */}
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

        {/* Modal pour modèles Pro */}
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
