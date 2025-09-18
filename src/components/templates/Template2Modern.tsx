import React, { Fragment, useMemo } from 'react';
import { Invoice, Quote } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Pagination par lot d’items :
 * - Toutes les pages intermédiaires : ITEMS_PER_PAGE
 * - Dernière page : ITEMS_PER_PAGE_LAST pour laisser la place aux totaux
 * - La signature est rendue sur une page dédiée si includeSignature === true
 */
const ITEMS_PER_PAGE = 12;
const ITEMS_PER_PAGE_LAST = 8;

interface TemplateProps {
  data: Invoice | Quote;
  type: 'invoice' | 'quote';
  includeSignature?: boolean;
}

type Item = {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total?: number;
  vatRate?: number;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function Header({ companyName, logoUrl, title }: { companyName: string; logoUrl?: string; title: string }) {
  return (
    <div className="pdf-header">
      <div className="p-8 border-b border-black bg-black text-white">
        <div className="flex items-center justify-between">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-20 w-auto" /> : <div className="h-20 w-20" />}
          <div className="flex-1 text-center">
            <h2 className="text-3xl font-extrabold">{companyName}</h2>
            <h1 className="text-xl font-bold mt-1">{title}</h1>
          </div>
          <div className="w-20" />
        </div>
      </div>
    </div>
  );
}

function Footer({ footerText }: { footerText: string }) {
  return (
    <div className="pdf-footer">
      <div className="bg-black text-white p-4 text-xs text-center border-t-2 border-white">
        <p>{footerText}</p>
      </div>
    </div>
  );
}

function ClientBoxes({
  client,
  date,
  number,
  type,
}: {
  client: any;
  date: string | number | Date;
  number?: string;
  type: 'invoice' | 'quote';
}) {
  return (
    <div className="border border-black rounded mb-6">
      <div className="grid grid-cols-2 gap-0">
        <div className="bg-gray-50 p-4 border-r border-black text-center">
          <h3 className="font-bold text-sm text-black mb-2 border-b border-black pb-2">
            CLIENT : {client?.name || ''}
          </h3>
          <div className="text-sm text-black space-y-1">
            {client?.address && <p>{client.address}</p>}
            {client?.city && <p>{client.city}</p>}
            {client?.ice && (
              <p>
                <strong>ICE:</strong> {client.ice}
              </p>
            )}
          </div>
        </div>
        <div className="bg-gray-50 p-4 text-center">
          <h3 className="font-bold text-sm text-black mb-2 border-b border-black pb-2">
            DATE : {new Date(date).toLocaleDateString('fr-FR')}
          </h3>
          <div className="text-sm text-black space-y-1">
            <p>
              <strong>{type === 'invoice' ? 'FACTURE' : 'DEVIS'} N° :</strong> {number || ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemsTable({ items }: { items: Item[] }) {
  return (
    <div className="border border-black rounded overflow-hidden mb-6 pdf-avoid-break">
      <table className="w-full">
        <thead className="bg-black text-white">
          <tr>
            <th className="border-r border-white px-3 py-3 text-center font-bold text-sm">DÉSIGNATION</th>
            <th className="border-r border-white px-3 py-3 text-center font-bold text-sm">QUANTITÉ</th>
            <th className="border-r border-white px-3 py-3 text-center font-bold text-sm">P.U. HT</th>
            <th className="px-3 py-3 text-center font-bold text-sm">TOTAL HT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const total = item.total ?? (item.unitPrice ?? 0) * (item.quantity ?? 0);
            return (
              <tr key={i} className="border-t border-black">
                <td className="border-r border-black px-3 py-2 text-center text-sm">{item.description}</td>
                <td className="border-r border-black px-3 py-2 text-center text-sm">
                  {(item.quantity ?? 0).toFixed(3)} {item.unit || 'unité'}
                </td>
                <td className="border-r border-black px-3 py-2 text-center text-sm">
                  {(item.unitPrice ?? 0).toFixed(2)} MAD
                </td>
                <td className="px-3 py-2 text-center text-sm font-medium">{total.toFixed(2)} MAD</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Template2Modern({ data, type, includeSignature = false }: TemplateProps) {
  const { user } = useAuth();
  const title = type === 'invoice' ? 'FACTURE' : 'DEVIS';

  const companyName = user?.company?.name || 'SOCIÉTÉ';
  const logoUrl = user?.company?.logo;
  const footerText = [
    user?.company?.name,
    user?.company?.address,
    user?.company?.phone ? `Tél : ${user.company.phone}` : '',
    user?.company?.ice ? `ICE : ${user.company.ice}` : '',
    user?.company?.if ? `IF : ${user.company.if}` : '',
    user?.company?.rc ? `RC : ${user.company.rc}` : '',
    user?.company?.cnss ? `CNSS : ${user.company.cnss}` : '',
    user?.company?.patente ? `Patente : ${user.company.patente}` : '',
    user?.company?.email ? `EMAIL : ${user.company.email}` : '',
    user?.company?.website ? `SITE WEB : ${user.company.website}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  // Prépare la pagination des items
  const pages = useMemo(() => {
    const items = (data.items as Item[]) || [];
    if (items.length === 0) return [[]] as Item[][];

    if (items.length <= ITEMS_PER_PAGE_LAST) {
      // Tout tient sur une seule page avec les totaux
      return [items];
    }

    // On réserve la dernière page avec moins de lignes pour les totaux
    const headCount = items.length - ITEMS_PER_PAGE_LAST;
    const middle = chunk(items.slice(0, headCount), ITEMS_PER_PAGE);
    return [...middle, items.slice(headCount)];
  }, [data.items]);

  // Calcul TVA groupée
  const vatGroups = useMemo(() => {
    const acc: Record<number, { amount: number; products: string[] }> = {};
    (data.items as Item[]).forEach((item) => {
      const rate = item.vatRate ?? 0;
      const vatAmount = ((item.unitPrice ?? 0) * (item.quantity ?? 0) * rate) / 100;
      if (!acc[rate]) acc[rate] = { amount: 0, products: [] };
      acc[rate].amount += vatAmount;
      acc[rate].products.push(item.description || '');
    });
    return acc;
  }, [data.items]);

  const rates = Object.keys(vatGroups);

  return (
    <div className="w-full">
      {/* ==== Pour chaque page d’items ==== */}
      {pages.map((items, pageIndex) => {
        const isLast = pageIndex === pages.length - 1;
        return (
          <Fragment key={pageIndex}>
            <div
              className="pdf-page bg-white mx-auto border border-black flex flex-col relative"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              <Header companyName={companyName} logoUrl={logoUrl} title={title} />
              <div className="pdf-content">
                {/* Infos haut */}
                <ClientBoxes client={data.client} date={data.date} number={data.number} type={type} />

                {/* Tableau (partie paginée) */}
                <ItemsTable items={items} />

                {/* Totaux uniquement sur la dernière page */}
                {isLast && (
                  <div className="mb-6 pdf-avoid-break">
                    <div className="flex justify-between gap-6">
                      {/* Bloc gauche */}
                      <div className="w-1/2 bg-gray-50 border border-black rounded p-3">
                        <div className="text-sm font-bold border-black pb-2 text-center">
                          Arrêtée le présent {type === 'invoice' ? 'facture' : 'devis'} à la somme de :
                        </div>
                        <div className="text-sm border-t border-black pt-2">
                          <p className="text-black">• {data.totalInWords || ''}</p>
                        </div>
                      </div>

                      {/* Bloc droit */}
                      <div className="w-1/2 bg-gray-50 border border-black rounded p-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span>Total HT :</span>
                          <span className="font-medium">{(data.subtotal ?? 0).toFixed(2)} MAD</span>
                        </div>

                        <div className="text-sm mb-2">
                          {rates.map((r) => (
                            <div key={r} className="flex justify-between">
                              <span>
                                TVA : {r}%{' '}
                                {rates.length > 1 && (
                                  <span style={{ fontSize: 10, color: '#555' }}>
                                    ({vatGroups[+r].products.join(', ')})
                                  </span>
                                )}
                              </span>
                              <span className="font-medium">{vatGroups[+r].amount.toFixed(2)} MAD</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between text-sm font-bold border-t border-black pt-2">
                          <span>TOTAL TTC :</span>
                          <span>{(data.totalTTC ?? 0).toFixed(2)} MAD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Footer footerText={footerText} />
            </div>

            {/* On force un saut de page visuel entre nos conteneurs */}
            {pageIndex < pages.length - 1 && <div className="html2pdf__page-break" />}
          </Fragment>
        );
      })}

      {/* Page signature dédiée (elle a aussi header + footer) */}
      {includeSignature && (
        <>
          <div className="html2pdf__page-break" />
          <div
            className="pdf-page bg-white mx-auto border border-black flex flex-col relative"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <Header companyName={companyName} logoUrl={logoUrl} title={title} />
            <div className="pdf-content">
              <div className="w-60 bg-gray-50 border border-black rounded p-4 text-center">
                <div className="text-sm font-bold mb-3">Signature</div>
                <div className="border-2 border-black rounded-sm h-24 flex items-center justify-center relative">
                  {user?.company?.signature ? (
                    <img
                      src={user.company.signature}
                      alt="Signature"
                      className="max-h-20 max-w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">&nbsp;</span>
                  )}
                </div>
              </div>
            </div>
            <Footer footerText={footerText} />
          </div>
        </>
      )}
    </div>
  );
}
