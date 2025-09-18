import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Product } from '../../contexts/DataContext';
import Modal from '../common/Modal';
import { Package, Plus, Minus, RotateCcw, AlertTriangle } from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  currentStock: number;
}

export default function StockAdjustmentModal({ isOpen, onClose, product, currentStock }: StockAdjustmentModalProps) {
  const { updateProduct, addStockMovement } = useData();
  const { user } = useAuth();
  const [adjustmentType, setAdjustmentType] = useState<'set' | 'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [adjustmentDateTime, setAdjustmentDateTime] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const predefinedReasons = [
    'Erreur de saisie',
    'Perte/Casse',
    'Vol/Disparition',
    'Retour client',
    'Inventaire physique',
    'Réception marchandise',
    'Correction administrative',
    'Autre'
  ];

  const calculateNewStock = () => {
    switch (adjustmentType) {
      case 'set':
        return quantity;
      case 'add':
        return currentStock + quantity;
      case 'subtract':
        return Math.max(0, currentStock - quantity);
      default:
        return currentStock;
    }
  };

  const calculateAdjustmentQuantity = () => {
    const newStock = calculateNewStock();
    return newStock - currentStock;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      alert('Veuillez saisir un motif de rectification');
      return;
    }

    if (adjustmentType === 'set' && quantity < 0) {
      alert('Le stock ne peut pas être négatif');
      return;
    }

    if (adjustmentType === 'subtract' && quantity > currentStock) {
      alert('Impossible de retirer plus que le stock actuel');
      return;
    }

    if (!user) {
      alert('Utilisateur non connecté');
      return;
    }
    setIsSubmitting(true);
    
    try {
      const adjustmentQuantity = calculateAdjustmentQuantity();
      const newStock = calculateNewStock();
      
      // Ajouter le mouvement de stock
      await addStockMovement({
        productId: product.id,
        productName: product.name,
        type: 'adjustment',
        quantity: adjustmentQuantity,
        previousStock: currentStock,
        newStock: newStock,
        reason: reason.trim(),
        userId: user.id,
        userName: user.name,
        date: adjustmentDateTime,
        adjustmentDateTime: new Date(adjustmentDateTime).toISOString()
      });

      // Mettre à jour le stock du produit directement
      await updateProduct(product.id, { stock: newStock });
      
      // Reset form
      setQuantity(0);
      setReason('');
      setAdjustmentType('add');
      
      onClose();
    } catch (error) {
      console.error('Erreur lors de la rectification:', error);
      alert('Erreur lors de la rectification du stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const newStock = calculateNewStock();
  const adjustmentQuantity = calculateAdjustmentQuantity();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rectifier le Stock" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations produit */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">{product.name}</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">{product.category}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Stock actuel:</span>
              <span className="ml-2 font-bold text-blue-900 dark:text-blue-100">
                {currentStock.toFixed(3)} {product.unit}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Stock minimum:</span>
              <span className="ml-2 font-bold text-blue-900 dark:text-blue-100">
                {product.minStock.toFixed(3)} {product.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Type d'ajustement */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Type de rectification
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <input
                type="radio"
                name="adjustmentType"
                value="add"
                checked={adjustmentType === 'add'}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="text-green-600 focus:ring-green-500"
              />
              <Plus className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Ajouter</span>
            </label>

            <label className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <input
                type="radio"
                name="adjustmentType"
                value="subtract"
                checked={adjustmentType === 'subtract'}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="text-red-600 focus:ring-red-500"
              />
              <Minus className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Retirer</span>
            </label>

            <label className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <input
                type="radio"
                name="adjustmentType"
                value="set"
                checked={adjustmentType === 'set'}
                onChange={(e) => setAdjustmentType(e.target.value as any)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <RotateCcw className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Définir</span>
            </label>
          </div>
        </div>

        {/* Quantité */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {adjustmentType === 'set' ? 'Nouveau stock' : 'Quantité'} ({product.unit})
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.001"
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder={adjustmentType === 'set' ? 'Stock final souhaité' : 'Quantité à ajuster'}
          />
        </div>

        {/* Motif */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date et heure de rectification
          </label>
          <input
            type="datetime-local"
            value={adjustmentDateTime}
            onChange={(e) => setAdjustmentDateTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Date et heure exactes de la rectification pour traçabilité
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motif de rectification *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-2"
          >
            <option value="">Sélectionner un motif</option>
            {predefinedReasons.map(predefinedReason => (
              <option key={predefinedReason} value={predefinedReason}>
                {predefinedReason}
              </option>
            ))}
          </select>
          
          {reason === 'Autre' && (
            <input
              type="text"
              placeholder="Précisez le motif..."
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          )}
        </div>

        {/* Aperçu du changement */}
        {quantity > 0 && (
          <div className={`p-4 rounded-lg border-2 ${
            adjustmentQuantity > 0 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600' 
              : adjustmentQuantity < 0 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
          }`}>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Aperçu de la rectification</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Stock actuel:</span>
                <div className="font-bold text-gray-900 dark:text-gray-100">
                  {currentStock.toFixed(3)} {product.unit}
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Ajustement:</span>
                <div className={`font-bold ${
                  adjustmentQuantity > 0 ? 'text-green-600' : 
                  adjustmentQuantity < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {adjustmentQuantity > 0 ? '+' : ''}{adjustmentQuantity.toFixed(3)} {product.unit}
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Nouveau stock:</span>
                <div className="font-bold text-blue-600">
                  {newStock.toFixed(3)} {product.unit}
                </div>
              </div>
            </div>
            
            {newStock <= product.minStock && (
              <div className="mt-3 flex items-center space-x-2 text-orange-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Attention: Le nouveau stock sera en dessous du seuil minimum
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || quantity <= 0 || !reason.trim()}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Rectification...' : 'Rectifier le Stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}