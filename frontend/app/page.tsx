"use client";

import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import MerchantCertification from "./components/MerchantCertification";
import VoucherManagement from "./components/VoucherManagement";
import VoucherConsumer from "./components/VoucherConsumer";
import VoucherEvents from "./components/VoucherEvents";
import { useTranslation } from "../i18n/client";


const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("merchant");
  const [txReceipt, setTxReceipt] = useState<UseWaitForTransactionReceiptReturnType['data']>();

  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };


  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-rose-600 bg-clip-text text-transparent">
              {t('common:title')}
            </h1>
            <div className="hidden md:flex items-center space-x-2 bg-rose-50 text-rose-600 rounded-full px-4 py-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">v25.4.6</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleLanguageChange("en")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                  i18n.language === "en"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => handleLanguageChange("hans")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                  i18n.language === "hans"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                简
              </button>
              <button
                onClick={() => handleLanguageChange("hant")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                  i18n.language === "hant"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                繁
              </button>
            </div>
            <ConnectButton 
              label={t('common:connect_wallet')}
              showBalance={false}
              accountStatus="address"
              chainStatus="none"
            />
          </div>
        </div>
      </header>

      {/* 主导航菜单 */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex -mb-px space-x-8">
            <button 
              onClick={() => setActiveTab("merchant")}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors duration-200 ${
                activeTab === "merchant" 
                  ? "border-rose-500 text-rose-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t('common:merchant_certification')}
            </button>
            <button 
              onClick={() => setActiveTab("voucher")}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors duration-200 ${
                activeTab === "voucher" 
                  ? "border-rose-500 text-rose-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t('common:voucher_management')}
            </button>
            <button 
              onClick={() => setActiveTab("consumer")}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors duration-200 ${
                activeTab === "consumer" 
                  ? "border-rose-500 text-rose-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t('common:voucher_consumption')}
            </button>
            <button 
              onClick={() => setActiveTab("events")}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors duration-200 ${
                activeTab === "events" 
                  ? "border-rose-500 text-rose-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t('common:event_records')}
            </button>
          </div>
        </div>
      </nav>

      {/* 内容区域 */}
      <main className="max-w-7xl mx-auto py-8 px-6">
        {activeTab === "merchant" && (
          <div className="animate-fadeIn">
            <MerchantCertification setTxReceipt={setTxReceipt} />
          </div>
        )}
        {activeTab === "voucher" && (
          <div className="animate-fadeIn">
            <VoucherManagement setTxReceipt={setTxReceipt} />
          </div>
        )}
        {activeTab === "consumer" && (
          <div className="animate-fadeIn">
            <VoucherConsumer setTxReceipt={setTxReceipt} />
          </div>
        )}
        {activeTab === "events" && (
          <div className="animate-fadeIn">
            <VoucherEvents txReceipt={txReceipt} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;