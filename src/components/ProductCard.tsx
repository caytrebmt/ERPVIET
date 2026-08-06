import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../utils/format";
import { getProductImageSrc } from "../utils/images";
import { useCart } from "../contexts/CartContext";
import { useLanguage } from "../contexts/LanguageContext";

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { language, t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [imgSrc, setImgSrc] = useState(() => getProductImageSrc(product.imageUrl, product.sku));

  const handleImageError = () => {
    setImgSrc(getProductImageSrc(null, product.sku));
  };

  const handleAddClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0 || adding) return;

    setAdding(true);
    const success = await addToCart(product.id, 1);
    setAdding(false);

    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  const showContact = product.contactForPrice;
  const isOutOfStock = product.stock <= 0;

  // Active language display fields
  const displayName = language === 'en' ? (product.name_en || product.name) : (product.name_vi || product.name);
  const displayUnit = language === 'en' ? (product.unit_en || product.unit || 'Pcs') : (product.unit_vi || product.unit || 'Cái');

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col h-full"
    >
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-950 shrink-0">
        <img
          src={imgSrc}
          alt={displayName}
          referrerPolicy="no-referrer"
          onError={handleImageError}
          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badges */}
        {product.images && product.images.length > 1 && (
          <span className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-xs text-amber-400 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md shadow-xs">
            +{product.images.length} {language === 'en' ? 'photos' : 'ảnh'}
          </span>
        )}

        {isOutOfStock ? (
          <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold tracking-wider px-2 py-1 rounded-sm uppercase shadow-xs">
            {language === 'en' ? 'Out of stock' : 'Hết hàng'}
          </span>
        ) : (
          product.stock <= 5 && (
            <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold tracking-wider px-2 py-1 rounded-sm uppercase shadow-xs">
              {language === 'en' ? `Only ${product.stock} ${displayUnit} left` : `Chỉ còn ${product.stock} ${displayUnit}`}
            </span>
          )
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2 flex-1">
          {displayName}
        </h3>

        {/* Pricing & CTA */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {!product.salePrice || showContact 
                ? (language === 'en' ? 'Contact for price' : 'Liên hệ')
                : formatPrice(product.salePrice)}
            </p>
          </div>

          <button
            onClick={handleAddClick}
            disabled={isOutOfStock || adding}
            className={`p-2 rounded-full cursor-pointer transition-all ${
              isOutOfStock
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : added
                ? "bg-green-600 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
            title={isOutOfStock ? (language === 'en' ? 'Out of stock' : 'Sản phẩm tạm hết hàng') : (language === 'en' ? 'Add to cart' : 'Thêm vào giỏ')}
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : added ? (
              <Check className="w-4 h-4" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
