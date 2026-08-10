import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Loader2, PackageOpen, ChevronRight, Tag, CheckCircle2 } from "lucide-react";
import client from "../api/client";
import { Product } from "../types";
import { useCart } from "../contexts/CartContext";
import { useToast } from "../contexts/ToastContext";
import { formatPrice } from "../utils/format";
import { getProductImageSrc } from "../utils/images";
import ProductCard from "../components/ProductCard";
import { useTranslation } from "react-i18next";

const ProductPage: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"desc" | "specs">("desc");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [failedImageIndexes, setFailedImageIndexes] = useState<number[]>([]);

  useEffect(() => {
    async function loadProductData() {
      if (!slug) return;
      try {
        if (!product) setLoading(true);
        // Reset local states
        setQuantity(1);
        setSelectedImgIndex(0);
        setFailedImageIndexes([]);

        // Fetch current product details
        const prodRes = await client.get(`/api/shop/products/${slug}`);
        if (prodRes.data?.ok) {
          const prod: Product = prodRes.data.data;
          setProduct(prod);

          // Get category name
          const catRes = await client.get("/api/shop/categories");
          if (catRes.data?.ok) {
            const cats = catRes.data.data.categories || [];
            const cat = cats.find((c: any) => c.id === prod.categoryId);
            if (cat) setCategoryName(cat.name);
          }

          // Load related products
          const relatedRes = await client.get("/api/shop/catalog", {
            params: { category_id: prod.categoryId, per_page: 4 },
          });
          if (relatedRes.data?.ok) {
            const filtered = relatedRes.data.data.products.filter((p: Product) => p.id !== prod.id);
            setRelatedProducts(filtered.slice(0, 4));
          }
        } else {
          showToast(t("page_product_not_found"), "error");
          navigate("/");
        }
      } catch (err) {
        console.error("Error loading product details", err);
        const message = err instanceof Error ? err.message : t("page_product_not_found");
        showToast(message, "error");
        navigate("/");
      } finally {
        setLoading(false);
      }
    }

    loadProductData();
  }, [slug]);

  const handleIncrement = () => {
    if (!product) return;
    if (quantity < product.stock) {
      setQuantity((prev) => prev + 1);
    } else {
      showToast(`Số lượng tồn kho tối đa khả dụng là ${product.stock} ${product.unit}`, "info");
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleAddToCart = async () => {
    if (!product || product.stock <= 0) return;

    setAdding(true);
    await addToCart(product.id, quantity);
    setAdding(false);
  };

  if (loading && !product) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 shadow-xs animate-pulse">
          <div className="lg:col-span-5 aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="h-4 w-1/4 bg-gray-100 dark:bg-gray-800 rounded-sm" />
            <div className="h-7 w-3/4 bg-gray-100 dark:bg-gray-800 rounded-sm" />
            <div className="h-14 w-full bg-gray-100 dark:bg-gray-800 rounded-lg" />
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-4">
        <PackageOpen className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-2" />
        <h3 className="font-semibold text-gray-700 dark:text-gray-300">Sản phẩm không khả dụng</h3>
        <Link to="/" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-2">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const isOutOfStock = product.stock <= 0;
  const showContact = product.contactForPrice || product.salePrice <= 0;
  const allImages = product.images && product.images.length > 0 ? product.images : [product.imageUrl || ''];

  const selectedImgRaw = allImages[selectedImgIndex] || allImages[0];
  const isSelectedFailed = failedImageIndexes.includes(selectedImgIndex);
  const mainImageSrc = isSelectedFailed
    ? getProductImageSrc(null, product.sku)
    : getProductImageSrc(selectedImgRaw, product.sku);

  return (
    <div className="flex flex-col gap-4">
      {/* Sleek Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xs border border-gray-200/80 dark:border-gray-800 rounded-lg px-3.5 py-2">
        <Link to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Trang chủ
        </Link>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <Link to={`/?category_id=${product.categoryId}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          {categoryName || "Danh mục"}
        </Link>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="text-gray-800 dark:text-gray-200 font-medium truncate max-w-sm">{product.name}</span>
      </nav>

      {/* Product Primary Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 shadow-xs transition-colors duration-200">
        
        {/* Left Column: Image Gallery (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-3">
          <div className="relative w-full aspect-square bg-gray-50 dark:bg-gray-950 rounded-lg overflow-hidden border border-gray-200/80 dark:border-gray-800 flex items-center justify-center p-3">
            <img
              src={mainImageSrc}
              alt={product.name}
              referrerPolicy="no-referrer"
              onError={() => {
                if (!failedImageIndexes.includes(selectedImgIndex)) {
                  setFailedImageIndexes((prev) => [...prev, selectedImgIndex]);
                }
              }}
              className="w-full h-full object-contain transition-all duration-200"
            />
            {allImages.length > 1 && (
              <span className="absolute bottom-2.5 right-2.5 bg-gray-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                {selectedImgIndex + 1} / {allImages.length}
              </span>
            )}
          </div>

          {/* Thumbnails List for products with multiple images */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto w-full p-0.5">
              {allImages.map((img, idx) => {
                const isThumbFailed = failedImageIndexes.includes(idx);
                const thumbSrc = isThumbFailed
                  ? getProductImageSrc(null, product.sku)
                  : getProductImageSrc(img, product.sku);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedImgIndex(idx)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      selectedImgIndex === idx
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 scale-102"
                        : "border-gray-200 dark:border-gray-800 opacity-70 hover:opacity-100"
                    }`}
                    title={`Xem ảnh ${idx + 1}`}
                  >
                    <img
                      src={thumbSrc}
                      alt={`${product.name} - ảnh ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Product Details (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            {/* Title */}
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-snug">
              {product.name}
            </h1>

            {/* Pricing Box */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-indigo-800 dark:text-indigo-300 font-medium block mb-0.5">Giá bán niêm yết:</span>
                {showContact ? (
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    Liên hệ
                  </span>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {formatPrice(product.salePrice)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">/ 1 {product.unit}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quantity Picker & Add to Cart Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                {!isOutOfStock && !showContact && (
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-950 h-10 sm:h-11 shrink-0 shadow-2xs">
                  <button
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    className="w-10 h-full flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={product.stock}
                    value={quantity}
                    onChange={(e) => {
                      let value = Number(e.target.value);
                      if (isNaN(value)) value = 1;
                      if (value < 1) value = 1;
                      if (value > product.stock) value = product.stock;
                      setQuantity(value);
                    }}
                    className="w-12 text-center outline-none font-semibold text-sm bg-transparent border-x border-gray-200 dark:border-gray-700 h-full text-gray-800 dark:text-gray-100"
                  />
                  <button
                    onClick={handleIncrement}
                    disabled={quantity >= product.stock}
                    className="w-10 h-full flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              )}

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || showContact || adding}
                className="flex-1 min-w-[120px] sm:min-w-0 h-10 sm:h-11 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow-xs cursor-pointer"
              >
                {adding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span className="hidden sm:inline">Đang thêm...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Thêm vào giỏ hàng</span>
                    <span className="sm:hidden">Thêm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs description / specifications */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:p-5 shadow-xs transition-colors duration-200">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 mb-4">
          <button
            onClick={() => setActiveTab("desc")}
            className={`pb-2.5 font-semibold text-sm relative transition-all cursor-pointer ${
              activeTab === "desc"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            }`}
          >
            Mô tả sản phẩm
            {activeTab === "desc" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("specs")}
            className={`pb-2.5 font-semibold text-sm relative transition-all cursor-pointer ${
              activeTab === "specs"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            }`}
          >
            Thông số kỹ thuật
            {activeTab === "specs" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {activeTab === "desc" ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{product.description}</p>
          ) : (
            <div className="bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              {product.specs ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {product.specs.split("|").map((spec, i) => {
                    const [key, val] = spec.split(":");
                    return (
                      <div key={i} className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-150 dark:border-gray-800 text-xs">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{key?.trim()}</span>
                        <span className="text-gray-500 dark:text-gray-400 font-medium">{val?.trim()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="py-2 px-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-150 dark:border-gray-800 flex justify-between">
                    <span className="text-gray-500">Mã SKU:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{product.sku}</span>
                  </div>
                  <div className="py-2 px-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-150 dark:border-gray-800 flex justify-between">
                    <span className="text-gray-500">Đơn vị:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{product.unit}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="flex flex-col gap-3 mt-1">
          <h2 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            SẢN PHẨM LIÊN QUAN
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {relatedProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
