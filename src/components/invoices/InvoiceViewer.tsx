import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const { isPro } = useLicense();

  // ====== ÉTATS ======
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('template2');
  const [includeSignature, setIncludeSignature] = useState<boolean>(true);
  const [showProModal, setShowProModal] = useState<boolean>(false);

  // Aperçu (dans la fenêtre)
  const previewRef = useRef<HTMLDivElement>(null);

  // Conteneur caché pour l'export (copie indépendante, hors modal)
  const exportRef = useRef<HTMLDivElement>(null);
  const [renderExportCopy, setRenderExportCopy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'download' | 'print' | null>(null);

  const filename = useMemo(() => {
    const safe = (invoice?.number || 'Facture').toString().replace(/[^\w\-]/g, '_');
    return `Facture_${safe}.pdf`;
  }, [invoice?.number]);

  // ====== OPTIONS HTML2PDF ======
  const makeOptions = (el: HTMLElement) => {
    // On capture sur une largeur réelle (scrollWidth) pour éviter canvas 0x0
    const windowWidth = el.scrollWidth || 794;
    const windowHeight = el.scrollHeight || 1123;

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
        windowWidth,
        windowHeight
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css'] as const }, // respecte .html2pdf__page-break & avoid rules
    };
  };

  const trySelectTemplate = (tpl: TemplateId) => {
    if (PRO_TEMPLATES.includes(tpl) && !isPro) {
      setShowProModal(true);
      return;
    }
    setSelectedTemplate(tpl);
  };

  // ====== UTIL: attendre que toutes les images de exportRef soient chargées ======
  const waitImages = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if ((img as HTMLImageElement).complete) return resolve();
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
      )
    );
  };

  // ====== LANCEMENT EXPORT APRÈS RENDU DE LA COPIE CACHÉE ======
  useEffect(() => {
    const run = async () => {
      if (!renderExportCopy || !exportRef.current || !pendingAction) return;

      const el = exportRef.current;
      // petite latence pour laisser le layout s'appliquer
      await new Promise((r) => setTimeout(r, 50));
      await waitImages(el);

      const options = makeOptions(el);

      if (pendingAction === 'download') {
        await html2pdf().from(el).set(options).save();
      } else {
        const worker = html2pdf().from(el).set(options).toPdf();
        const pdf = await worker.get('pdf');
        // @ts-ignore jsPDF
        pdf.autoPrint();
        const blobUrl = pdf.output('bloburl');
        const win = window.open(blobUrl, '_blank');
        if (!win) await worker.save();
      }

      // Nettoyage
      setPendingAction(null);
      setRenderExportCopy(false);
    };

    run();
  }, [renderExportCopy, pendingAction]);

  const handleDownload = async () => {
    if (onDownload) onDownload();
    setPendingAction('download');
    setRenderExportCopy(true);
  };

  const handlePrint = async () => {
    setPendingAction('print');
    setRenderExportCopy(true);
  };

  return (
    <>
      {/* ====== MODAL D'APERÇU ====== */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-[1100px] max-h-[92vh] overflow-hidden flex flex-col">
          {/* Barre d’actions */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <h2 className="text-lg font-semibold">
                Aperçu {invoice?.number ? `– ${invoice.number}` : ''} ({TEMPLATE_LABELS[selectedTemplate]})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Choix du modèle */}
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

              {/* Signature */}
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

          {/* Zone d’aperçu défilante */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div ref={previewRef} className="mx-auto">
              <TemplateRenderer
                templateId={selectedTemplate}
                data={invoice}
                type="invoice"
                includeSignature={includeSignature}
              />
            </div>
          </div>

          {/* Modal Pro */}
          {showProModal && (
            <ProTemplateModal
              isOpen={showProModal}
              onClose={() => setShowProModal(false)}
              templateName={TEMPLATE_LABELS[selectedTemplate]}
            />
          )}
        </div>
      </div>

      {/* ====== COPIE CACHÉE POUR EXPORT ======
          - Placée hors du modal, pas d'overflow/position fixed
          - Largeur A4 (794px) pour un rendu stable
      */}
      <div
        style={{
          position: 'absolute',
          left: '-10000px',
          top: 0,
          width: '794px',
          background: '#ffffff',
          // pas de display:none -> il faut que le DOM soit mesurable
        }}
        aria-hidden
      >
        {renderExportCopy && (
          <div ref={exportRef}>
            <TemplateRenderer
              templateId={selectedTemplate}
              data={invoice}
              type="invoice"
              includeSignature={includeSignature}
            />
          </div>
        )}
      </div>
    </>
  );
}
