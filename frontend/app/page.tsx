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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
        <h1>Voucher Token System</h1>
        <ConnectButton />
      </div>
      
      <div style={{ display: 'flex', margin: '10px 0' }}>
        <button 
          onClick={() => setActiveTab("merchant")}
          style={{ margin: '0 5px', fontWeight: activeTab === "merchant" ? 'bold' : 'normal' }}
        >
          商户认证
        </button>
        <button 
          onClick={() => setActiveTab("voucher")}
          style={{ margin: '0 5px', fontWeight: activeTab === "voucher" ? 'bold' : 'normal' }}
        >
          代金券管理
        </button>
        <button 
          onClick={() => setActiveTab("consumer")}
          style={{ margin: '0 5px', fontWeight: activeTab === "consumer" ? 'bold' : 'normal' }}
        >
          代金券消费
        </button>
        <button 
          onClick={() => setActiveTab("events")}
          style={{ margin: '0 5px', fontWeight: activeTab === "events" ? 'bold' : 'normal' }}
        >
          事件记录
        </button>
      </div>
      
      {activeTab === "merchant" && <MerchantCertification setTxReceipt={setTxReceipt} />}
      {activeTab === "voucher" && <VoucherManagement setTxReceipt={setTxReceipt} />}
      {activeTab === "consumer" && <VoucherConsumer setTxReceipt={setTxReceipt} />}
      {activeTab === "events" && <VoucherEvents txReceipt={txReceipt} />}
    </div>
  );
};

export default Home;