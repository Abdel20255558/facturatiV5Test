import React from 'react';
import { Invoice, Quote } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';

interface TemplateProps {
  data: Invoice | Quote;
  type: 'invoice' | 'quote';
  includeSignature?: boolean;
}

export default function Template2Modern({ data, type, includeSignature = false }: TemplateProps) {
  const { user } = useAuth();
  const title = type === 'invoice' ? 'FACTURE' : 'DEVIS';

  return (
    <div className="pdf-page" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* ===== HEADER (pinned per page) ===== */}
      <div className="pdf-header">
        <div className="p-8 border-b border-black bg-black text-white">
          <div className="flex items-center justify-between">
            {/* Logo */}
            {user?.company.logo ? (
              <img src={user.company.logo} alt="Logo" className="h-24 w-auto" />
            ) : (
              <div className="h-24 w-24" />
            )}

            {/* Company + Title centered */}
            <div className="flex-1 text-center">
              <h2 className="text-3xl font-extrabold">{user?.company.name}</h2>
              <h1 className="text-xl font-bold mt-1">{title}</h1>
            </div>

            {/* Spacer to balance layout */}
            <div className="w-24" />
          </div>
        </div>
      </div>

      {/* ===== PAGE FLOW CONTENT ===== */}
      <div className="pdf-content">
        {/* CLIENT + DATES */}
        <div className="border border-black rounded mb-6">
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-gray-50 p-4 border-r border-black text-center">
              <h3 className="font-bold text-sm text-black mb-2 border-b border-black pb-2">
                CLIENT : {data.client.name}
              </h3>
              <div className="text-sm text-black space-y-1">
                {data.client.address && <p>{data.client.address}</p>}
                {data.client.ice && (
                  <p>
                    <strong>ICE:</strong> {data.client.ice}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-4 text-center">
              <h3 className="font-bold text-sm text-black mb-2 border-b border-black pb-2">
                DATE : {new Date(data.date).toLocaleDateString('fr-FR')}
              </h3>
              <div className="text-sm text-black space-y-1">
                <p>
                  <strong>{type === 'invoice' ? 'FACTURE' : 'DEVIS'} N° :</strong> {data.number}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE PRODUITS */}
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
              {data.items.map((item, i) => (
                <tr key={i} className="border-t border-black">
                  <td className="border-r border-black px-3 py-2 text-center text-sm">{item.description}</td>
                  <td className="border-r border-black px-3 py-2 text-center text-sm">
                    {item.quantity.toFixed(3)} ({item.unit || 'unité'})
                  </td>
                  <td className="border-r border-black px-3 py-2 text-center text-sm">
                    {item.unitPrice.toFixed(2)} MAD
                  </td>
                  <td className="px-3 py-2 text-center text-sm font-medium">
                    {item.total.toFixed(2)} MAD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TOTALS (kept together) */}
        <div className="mb-6 pdf-avoid-break">
          <div className="flex justify-between gap-6">
            {/* Bloc gauche */}
            <div className="w-1/2 bg-gray-50 border border-black rounded p-3">
              <div className="text-sm font-bold border-black pb-2 text-center">
                Arrêtée le présent {type === 'invoice' ? 'facture' : 'devis'} à la somme de :
              </div>
              <div className="text-sm border-t border-black pt-2">
                <p className="text-black">• {data.totalInWords}</p>
              </div>
            </div>

            {/* Bloc droit */}
            <div className="w-1/2 bg-gray-50 border border-black rounded p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Total HT :</span>
                <span className="font-medium">{data.subtotal.toFixed(2)} MAD</span>
              </div>

              {/* TVA regroupée */}
              <div className="text-sm mb-2">
                {(() => {
                  const vatGroups = data.items.reduce(
                    (acc: Record<number, { amount: number; products: string[] }>, item) => {
                      const vatAmount = (item.unitPrice * item.quantity * item.vatRate) / 100;
                      if (!acc[item.vatRate]) acc[item.vatRate] = { amount: 0, products: [] };
                      acc[item.vatRate].amount += vatAmount;
                      acc[item.vatRate].products.push(item.description);
                      return acc;
                    },
                    {}
                  );
                  const rates = Object.keys(vatGroups);
                  return rates.map((r) => (
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
                  ));
                })()}
              </div>

              <div className="flex justify-between text-sm font-bold border-t border-black pt-2">
                <span>TOTAL TTC :</span>
                <span>{data.totalTTC.toFixed(2)} MAD</span>
              </div>
            </div>
          </div>
        </div>

        {/* ====== FORCE NEW PAGE BEFORE SIGNATURE ====== */}
        <div className="html2pdf__page-break"></div>

        {/* SIGNATURE (isolated page section so it never collides with footer) */}
        <div className="pdf-avoid-break">
          <div className="w-60 bg-gray-50 border border-black rounded p-4 text-center">
            <div className="text-sm font-bold mb-3">Signature</div>
            <div className="border-2 border-black rounded-sm h-20 flex items-center justify-center relative">
              {includeSignature && user?.company?.signature ? (
                <img
                  src={user.company.signature}
                  alt="Signature"
                  className="max-h-18 max-w-full object-contain"
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
      </div>

      {/* ===== FOOTER (pinned per page) ===== */}
      <div className="pdf-footer">
        <div className="bg-black text-white p-4 text-xs text-center border-t-2 border-white">
          <p>
            <strong>{user?.company.name}</strong> | {user?.company.address} | <strong>Tél :</strong>{' '}
            {user?.company.phone} | <strong>ICE :</strong> {user?.company.ice} | <strong>IF:</strong>{' '}
            {user?.company.if} | <strong>RC:</strong> {user?.company.rc} | <strong>CNSS:</strong>{' '}
            {user?.company.cnss} | <strong>Patente :</strong> {user?.company.patente} | <strong>EMAIL :</strong>{' '}
            {user?.company.email} | <strong>SITE WEB :</strong> {user?.company.website}
          </p>
        </div>
      </div>
    </div>
  );
}
