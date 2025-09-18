import React from 'react';
import { useData } from '../../contexts/DataContext';
import { Package, TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';

export default function StockOverviewWidget() {
  const { products, invoices, stockMovements } = useData();

  // Calculer le stock actuel selon la formule correcte
  const calculateCurrentStock = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    // Stock initial
    const initialStock = product.initialStock || 0;

    // Total des rectifications
    const adjustments = stockMovements
      .filter(m => m.productId === productId && m.type === 'adjustment')
      .reduce((sum, m) => sum + m.quantity, 0);

    // Total des ventes
    const sales = invoices.reduce((sum, invoice) => {
      return sum + invoice.items
        .filter(item => item.description === product.name)
        .reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    return initialStock + adjustments - sales;
  };

  // Calculer les statistiques globales
  const totalProducts = products.length;
  const lowStockProducts = products.filter(product => {
    const remainingStock = calculateCurrentStock(product.id);
    return remainingStock <= product.minStock;
  }).length;

  const outOfStockProducts = products.filter(product => {
    const remainingStock = calculateCurrentStock(product.id);
    return remainingStock <= 0;
  }).length;

  const totalStockValue = products.reduce((sum, product) => {
    const remainingStock = calculateCurrentStock(product.id);
    return sum + (remainingStock * (product.purchasePrice || 0));
  }, 0);

  // Mouvements récents (7 derniers jours)
  const recentMovements = stockMovements?.filter(movement => {
    const movementDate = new Date(movement.date);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return movementDate >= sevenDaysAgo;
  }) || [];

  const recentAdjustments = recentMovements.filter(m => m.type === 'adjustment').length;
  const recentSales = invoices.filter(invoice => {
    const invoiceDate = new Date(invoice.date);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return invoiceDate >= sevenDaysAgo;
  }).length;

  const stats = [
    {
      title: 'Total Produits',
      value: totalProducts.toString(),
      subtitle: 'Catalogue complet',
      icon: Package,
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-blue-600'
    },
    {
      title: 'Stock Faible',
      value: lowStockProducts.toString(),
      subtitle: 'Sous le seuil minimum',
      icon: AlertTriangle,
      color: 'from-orange-500 to-red-600',
      textColor: 'text-orange-600'
    },
    {
      title: 'Ruptures',
      value: outOfStockProducts.toString(),
      subtitle: 'Stock épuisé',
      icon: TrendingDown,
      color: 'from-red-500 to-red-600',
      textColor: 'text-red-600'
    },
    {
      title: 'Valeur Stock',
      value: `${totalStockValue.toLocaleString()}`,
      subtitle: 'MAD (prix d\'achat)',
      icon: BarChart3,
      color: 'from-green-500 to-emerald-600',
      textColor: 'text-green-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        
        return (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{stat.title}</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {stat.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}