"use client";

import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import MerchantCertification from "./components/MerchantCertification";
import VoucherManagement from "./components/VoucherManagement";
import VoucherConsumer from "./components/VoucherConsumer";
import VoucherEvents from "./components/VoucherEvents";

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("merchant");
  const [txReceipt, setTxReceipt] = useState<UseWaitForTransactionReceiptReturnType['data']>();

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-rose-500">代金券系统</h1>
          <div className="flex items-center space-x-4">
            <div className="bg-rose-100 text-rose-500 rounded-lg px-3 py-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">900</span>
            </div>
            <div className="text-gray-800">
              <span>×1 代币倍数</span>
            </div>
            <ConnectButton label="连接钱包" />
          </div>
        </div>
      </header>

      {/* 主导航菜单 */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex -mb-px">
            <button 
              onClick={() => setActiveTab("merchant")}
              className={`py-4 px-6 font-medium focus:outline-none ${
                activeTab === "merchant" 
                  ? "border-b-2 border-gray-900 text-gray-900" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              商户认证
            </button>
            <button 
              onClick={() => setActiveTab("voucher")}
              className={`py-4 px-6 font-medium focus:outline-none ${
                activeTab === "voucher" 
                  ? "border-b-2 border-gray-900 text-gray-900" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              代金券管理
            </button>
            <button 
              onClick={() => setActiveTab("consumer")}
              className={`py-4 px-6 font-medium focus:outline-none ${
                activeTab === "consumer" 
                  ? "border-b-2 border-gray-900 text-gray-900" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              代金券消费
            </button>
            <button 
              onClick={() => setActiveTab("events")}
              className={`py-4 px-6 font-medium focus:outline-none ${
                activeTab === "events" 
                  ? "border-b-2 border-gray-900 text-gray-900" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              事件记录
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