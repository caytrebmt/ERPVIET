import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Tag, AlertTriangle } from "lucide-react";
import client from "../api/client";
import { Product, Category, Promotion } from "../types";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";

const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read query params
  const categoryIdParam = searchParams.get("category_id");
  const searchQuery = searchParams.get("search") || "";

  useEffect(() => {
    async function loadCatalogData() {
      try {
        setError(null);
        setRefreshing(true);

        const [catalogRes, promotionsRes] = await Promise.all([
          client.get("/api/shop/catalog", {
            params: {
              category_id: categoryIdParam || undefined,
              search: searchQuery || undefined,
            },
          }),
          client.get("/api/shop/promotions"),
        ]);

        if (catalogRes.data?.ok) {
          const cats = catalogRes.data?.data?.categories || [];
          setCategories(Array.isArray(cats) ? cats : []);
          const prods = catalogRes.data?.data?.products || catalogRes.data?.data?.items || catalogRes.data?.products || [];
          setProducts(Array.isArray(prods) ? prods : []);
        }
        if (promotionsRes.data?.ok) {
          const promos = promotionsRes.data?.data?.promotions || promotionsRes.data?.promotions || promotionsRes.data?.data || [];
          setPromotions(Array.isArray(promos) ? promos : []);
        }
      } catch (err) {
        console.error("Error loading catalog data", err);
        setError(
          language === "en"
            ? "Could not connect to services. Please check connection."
            : "Không thể kết nối với hệ thống. Vui lòng kiểm tra lại kết nối."
        );
      } finally {
        setRefreshing(false);
        setInitialLoading(false);
      }
    }

    loadCatalogData();
  }, [categoryIdParam, searchQuery, language]);

  const selectCategory = (id: number | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set("category_id", String(id));
    } else {
      newParams.delete("category_id");
    }
    setSearchParams(newParams);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Product Catalog Grid area */}
      <div className="flex flex-col gap-5 min-h-[70vh]">
        {/* Top category bar for Mobile & Search results indicator */}
        <div className="flex flex-col gap-4">
          {/* Horizontal Categories - Mobile Only */}
          <div className="lg:hidden overflow-x-auto pb-2 flex gap-2 no-scrollbar">
            <button
              onClick={() => selectCategory(null)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                !categoryIdParam
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400"
              }`}
            >
              {language === 'en' ? 'All Products' : 'Tất cả SP'}
            </button>
            {categories.map((cat) => {
              const catName = language === 'en'
                ? (cat.name_en || cat.nameEn || cat.name)
                : (cat.name_vi || cat.name);
              return (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    Number(categoryIdParam) === cat.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {catName}
                </button>
              );
            })}
          </div>

          {/* Search metadata indicator */}
          {searchQuery && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center justify-between text-sm shadow-xs transition-colors duration-205">
              <span className="text-gray-500 dark:text-gray-400">
                {language === 'en' ? 'Search results for:' : 'Kết quả tìm kiếm cho:'}{" "}
                <strong className="text-gray-900 dark:text-white">"{searchQuery}"</strong>
              </span>
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete("search");
                  setSearchParams(params);
                }}
                className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
              >
                {language === 'en' ? 'Clear search' : 'Xóa tìm kiếm'}
              </button>
            </div>
          )}
        </div>

        {/* Catalog Error State */}
        {error && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 p-4 rounded-xl flex gap-3 items-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Products Grid / Skeletons */}
        {initialLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 content-start">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-4 animate-pulse shadow-xs"
              >
                <div className="aspect-square w-full bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-sm w-1/3"></div>
                <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-sm w-3/4"></div>
                <div className="flex justify-between items-center mt-auto">
                  <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded-sm w-1/2"></div>
                  <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl py-16 px-4 text-center shadow-xs">
            <Search className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-base">
              {language === 'en' ? 'No matching products found' : 'Không tìm thấy sản phẩm phù hợp'}
            </h4>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
              {language === 'en'
                ? 'Please try searching with another keyword or select a different category.'
                : 'Vui lòng thử lại với từ khóa khác hoặc chuyển danh mục sản phẩm khác.'}
            </p>
          </div>
        ) : (
          <motion.div
            key={`${categoryIdParam ?? "all"}-${searchQuery}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 content-start"
          >
            {products.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CatalogPage;
