import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Tag, AlertTriangle, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import client from "../api/client";
import { Product, Category, Promotion } from "../types";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";

const PAGE_SIZE = 24;
const VISIBLE_PAGES = 5;

const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Read query params
  const categoryIdParam = searchParams.get("category_id");
  const searchQuery = searchParams.get("search") || "";
  const pageParam = searchParams.get("page");
  const currentPage = Math.max(1, Number(pageParam || 1));

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
              page: currentPage,
              limit: PAGE_SIZE,
            },
          }),
          client.get("/api/shop/promotions"),
        ]);

        if (catalogRes.data?.ok) {
          const cats = catalogRes.data?.data?.categories || [];
          setCategories(Array.isArray(cats) ? cats : []);
          const prods = catalogRes.data?.data?.products || catalogRes.data?.data?.items || catalogRes.data?.products || [];
          setProducts(Array.isArray(prods) ? prods : []);
          setTotalPages(Number(catalogRes.data?.data?.totalPages) || 1);
          setTotal(Number(catalogRes.data?.data?.total ?? catalogRes.data?.data?.items?.length ?? 0));
        }
        if (promotionsRes.data?.ok) {
          const promos = promotionsRes.data?.data?.promotions || promotionsRes.data?.promotions || promotionsRes.data?.data || [];
          setPromotions(Array.isArray(promos) ? promos : []);
        }
      } catch (err) {
        console.error("Error loading catalog data", err);
        setError(
          t("catalog_connection_error")
        );
      } finally {
        setRefreshing(false);
        setInitialLoading(false);
      }
    }

    loadCatalogData();
  }, [categoryIdParam, searchQuery, currentPage, language]);

  const goToPage = (page: number) => {
    const target = Math.max(1, Math.min(totalPages, page));
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(target));
    setSearchParams(newParams);
  };

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= VISIBLE_PAGES) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    const half = Math.floor((VISIBLE_PAGES - 1) / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + VISIBLE_PAGES - 1);

    if (end - start + 1 < VISIBLE_PAGES) {
      start = Math.max(1, end - VISIBLE_PAGES + 1);
    }

    const windowPages: number[] = [];
    for (let i = start; i <= end; i++) windowPages.push(i);

    pages.push(1);
    if (windowPages[0] > 2) pages.push("ellipsis");

    windowPages.forEach((p) => {
      if (p !== 1 && p !== totalPages) pages.push(p);
    });

    if (windowPages[windowPages.length - 1] < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  const selectCategory = (id: number | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set("category_id", String(id));
    } else {
      newParams.delete("category_id");
    }
    newParams.delete("search");
    newParams.set("page", "1");
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
               {t('catalog_all_products')}
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
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-sm shadow-xs">
              <span className="text-gray-500 dark:text-gray-400">
                 {t('catalog_search_results')}{" "}
                <strong className="text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none inline-block align-bottom">"{searchQuery}"</strong>
              </span>
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete("search");
                  params.set("page", "1");
                  setSearchParams(params);
                }}
                className="text-xs font-semibold text-red-600 hover:underline cursor-pointer whitespace-nowrap"
              >
                 {t('catalog_clear_search')}
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
               {t('catalog_no_products')}
            </h4>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
                {t("catalog_empty_try_another")}
              </p>
            </p>
          </div>
        ) : (
          <motion.div
            key={`${categoryIdParam ?? "all"}-${searchQuery}-${currentPage}`}
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

        {/* Pagination Controls */}
        {totalPages > 1 && !initialLoading && (
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {language === 'en'
                ? `${t("catalog_showing")} ${Math.min(total, (currentPage - 1) * PAGE_SIZE + 1)}–${Math.min(total, currentPage * PAGE_SIZE)} ${t("catalog_of")} ${total} ${t("catalog_products")}`
                : `${t("catalog_showing")} ${Math.min(total, (currentPage - 1) * PAGE_SIZE + 1)}–${Math.min(total, currentPage * PAGE_SIZE)} ${t("catalog_of")} ${total} ${t("catalog_products")}`}
            </span>

            <nav
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 shadow-xs text-sm overflow-x-auto"
              aria-label="Pagination"
            >
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || refreshing}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                 aria-label={t('catalog_previous_page')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {getPageNumbers().map((p, idx) =>
                typeof p === "string" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-400 dark:text-gray-500"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    disabled={refreshing}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-md font-medium transition-colors ${
                      p === currentPage
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    aria-current={p === currentPage ? "page" : undefined}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || refreshing}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                 aria-label={t('catalog_next_page')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogPage;
