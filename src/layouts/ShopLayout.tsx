import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "motion/react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";

interface ShopLayoutProps {
  children: React.ReactNode;
}

const ShopLayout: React.FC<ShopLayoutProps> = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFB] dark:bg-[#030712] text-[#111827] dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Universal Sticky Header */}
      <Header />

      {/* Body: Sidebar + Main */}
      <div className="flex flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto">
        <Sidebar />

        {/* Main Container */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 md:py-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Universal Footer */}
      <Footer />
    </div>
  );
};

export default ShopLayout;


export {};
