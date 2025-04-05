"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import useMultiBaas from "../hooks/useMultiBaas";
import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import { useTranslation } from "../../i18n/client";

interface VoucherType {
  tokenId: number;
  expiry: string;
  maxUsage: number;
  singleUsageLimit: string;
  allowedMerchantTypes: number[];
}

interface VoucherManagementProps {
  setTxReceipt: (receipt: UseWaitForTransactionReceiptReturnType['data']) => void;
}

const VoucherManagement: React.FC<VoucherManagementProps> = ({ setTxReceipt }) => {
  const { voucher } = useMultiBaas();
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { t } = useTranslation();
  
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<`0x${string}`>();
  
  // 新建代金券类型的状态
  const [tokenId, setTokenId] = useState<number>(1);
  const [expirationDays, setExpirationDays] = useState<number>(90);
  const [maxUsage, setMaxUsage] = useState<number>(3);
  const [singleUsageLimit, setSingleUsageLimit] = useState<number>(100000000); // 0.1 CELO in wei
  const [allowedMerchantTypes, setAllowedMerchantTypes] = useState<string>("1,2");
  
  // 铸造代金券的状态
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [mintTokenId, setMintTokenId] = useState<number>(1);
  const [mintAmount, setMintAmount] = useState<number>(100000000); // 0.1 CELO in wei
  
  // 可认领代金券的状态
  const [claimableTokenId, setClaimableTokenId] = useState<number>(1);
  const [claimableAmount, setClaimableAmount] = useState<number>(1000000000); // 1 CELO in wei
  const [claimLimit, setClaimLimit] = useState<number>(100000000); // 0.1 CELO in wei
  
  const { data: txReceipt, isLoading: isTxProcessing } = useWaitForTransactionReceipt({ hash: txHash });
  
  // 加载代金券类型
  const loadVoucherTypes = async () => {
    try {
      setIsLoading(true);
      
      // 获取已定义的代金券类型列表
      const events = await voucher.getVoucherDefinedEvents(50);
      if (!events || events.length === 0) {
        setVoucherTypes([]);
        setIsLoading(false);
        return;
      }

      // 从事件中解析代金券类型信息
      const types: VoucherType[] = events.map(event => {
        const inputs = event.event.inputs;
        return {
          tokenId: Number(inputs.find(input => input.name === "tokenId")?.value || 0),
          expiry: new Date(Number(inputs.find(input => input.name === "expiry")?.value || 0) * 1000).toLocaleString(),
          maxUsage: Number(inputs.find(input => input.name === "maxUsage")?.value || 0),
          singleUsageLimit: inputs.find(input => input.name === "singleUsageLimit")?.value.toString() || "0",
          allowedMerchantTypes: (inputs.find(input => input.name === "allowedMerchantTypes")?.value as string[]).map(Number)
        };
      });
      
      // 按tokenId排序
      types.sort((a, b) => b.tokenId - a.tokenId);
      
      // 如果有重复的tokenId，只保留最新的定义
      const uniqueTypes = types.reduce((acc, current) => {
        const exists = acc.find(item => item.tokenId === current.tokenId);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, [] as VoucherType[]);
      
      setVoucherTypes(uniqueTypes);
    } catch (error) {
      console.error("Error loading voucher types:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 定义新代金券类型
  const defineVoucherType = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      // 计算过期时间（当前时间 + 天数）
      const expiryTime = Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60);
      
      // 将逗号分隔的字符串转为数字数组
      const merchantTypes = allowedMerchantTypes.split(',').map(Number);
      
      const tx = await voucher.defineVoucherType(
        tokenId,
        expiryTime,
        maxUsage,
        singleUsageLimit,
        merchantTypes
      );
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      // 等待交易确认后重新加载数据
      setTimeout(() => {
        loadVoucherTypes();
      }, 5000);
    } catch (error) {
      console.error("Error defining voucher type:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 铸造代金券
  const mintVoucher = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const tx = await voucher.mintVoucher(
        recipientAddress || address!, // 如果未指定地址，使用当前钱包地址
        mintTokenId,
        mintAmount
      );
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      // 提示成功
      setTimeout(() => {
        setIsLoading(false);
        alert(`代金券铸造成功：TokenID ${mintTokenId}, 金额 ${mintAmount} wei`);
      }, 5000);
    } catch (error) {
      console.error("Error minting voucher:", error);
      setIsLoading(false);
    }
  };
  
  // 存入资金
  const depositFunds = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const tx = await voucher.deposit();
      tx.value = BigInt(mintAmount); // 设置交易金额
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      setTimeout(() => {
        setIsLoading(false);
        alert(`存入资金成功: ${mintAmount} wei`);
      }, 5000);
    } catch (error) {
      console.error("Error depositing funds:", error);
      setIsLoading(false);
    }
  };
  
  // 添加铸造可认领代金券的函数
  const mintClaimableVoucher = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const tx = await voucher.mintClaimableVoucher(
        claimableTokenId,
        claimableAmount,
        claimLimit
      );
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      setTimeout(() => {
        setIsLoading(false);
        alert(`可认领代金券铸造成功：TokenID ${claimableTokenId}`);
      }, 5000);
    } catch (error) {
      console.error("Error minting claimable voucher:", error);
      setIsLoading(false);
    }
  };
  
  // 初始加载及钱包连接后加载数据
  useEffect(() => {
    if (isConnected) {
      loadVoucherTypes();
    }
  }, [isConnected]);
  
  // 当交易收据有更新时，通知父组件
  useEffect(() => {
    if (txReceipt && txReceipt.status === 'success') {
      setTxReceipt(txReceipt);
    }
  }, [txReceipt, setTxReceipt]);
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-8">{t('voucher:title')}</h2>
      
      {!isConnected ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-600 mb-4">{t('voucher:messages:connectWallet')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 第一行：左侧 - 定义代金券类型 */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">{t('voucher:defineVoucher:title')}</h3>
              </div>
              <div className="card-body space-y-4 flex flex-col" style={{ minHeight: "280px" }}>
                <div className="flex-grow space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:defineVoucher:tokenId')}
                      </label>
                      <input 
                        type="number" 
                        value={tokenId} 
                        onChange={(e) => setTokenId(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:defineVoucher:expirationDays')}
                      </label>
                      <input 
                        type="number" 
                        value={expirationDays} 
                        onChange={(e) => setExpirationDays(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:defineVoucher:maxUsage')}
                      </label>
                      <input 
                        type="number" 
                        value={maxUsage} 
                        onChange={(e) => setMaxUsage(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:defineVoucher:singleUsageLimit')}
                      </label>
                      <input 
                        type="number" 
                        value={singleUsageLimit} 
                        onChange={(e) => setSingleUsageLimit(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('voucher:defineVoucher:allowedMerchantTypes')}
                    </label>
                    <input 
                      type="text" 
                      value={allowedMerchantTypes} 
                      onChange={(e) => setAllowedMerchantTypes(e.target.value)} 
                      className="w-full"
                    />
                  </div>
                </div>
                <button 
                  onClick={defineVoucherType} 
                  disabled={isLoading || isTxProcessing}
                  className="btn btn-primary w-full mt-auto"
                  style={{ backgroundColor: "#000", color: "#fff" }}
                >
                  {isLoading || isTxProcessing ? t('voucher:messages:processing') : t('voucher:defineVoucher:submit')}
                </button>
              </div>
            </div>
            
            {/* 第一行：右侧 - 铸造代金券 */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">{t('voucher:mintVoucher:title')}</h3>
              </div>
              <div className="card-body space-y-4 flex flex-col" style={{ minHeight: "280px" }}>
                <div className="flex-grow space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('voucher:mintVoucher:recipientAddress')}
                    </label>
                    <input 
                      type="text" 
                      value={recipientAddress} 
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder={t('voucher:mintVoucher:placeholder:useCurrentAddress')} 
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:mintVoucher:tokenId')}
                      </label>
                      <input 
                        type="number" 
                        value={mintTokenId} 
                        onChange={(e) => setMintTokenId(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:mintVoucher:amount')}
                      </label>
                      <input 
                        type="number" 
                        value={mintAmount} 
                        onChange={(e) => setMintAmount(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={mintVoucher} 
                  disabled={isLoading || isTxProcessing}
                  className="btn btn-primary w-full mt-auto"
                  style={{ backgroundColor: "#000", color: "#fff" , marginTop: "97px"}}
                >
                  {isLoading || isTxProcessing ? t('voucher:messages:processing') : t('voucher:mintVoucher:submit')}
                </button>
              </div>
            </div>
            
            {/* 第二行：左侧 - 存入资金 */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">{t('voucher:deposit:title')}</h3>
              </div>
              <div className="card-body space-y-4 flex flex-col" style={{ minHeight: "180px" }}>
                <div className="flex-grow space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('voucher:deposit:amount')}
                    </label>
                    <input 
                      type="number" 
                      value={mintAmount} 
                      onChange={(e) => setMintAmount(Number(e.target.value))} 
                      min="1"
                      className="w-full"
                    />
                  </div>
                </div>
                <button 
                  onClick={depositFunds} 
                  disabled={isLoading || isTxProcessing}
                  className="btn btn-primary w-full mt-auto"
                  style={{ backgroundColor: "#000", color: "#fff" , marginTop: "97px" }}
                >
                  {isLoading || isTxProcessing ? t('voucher:messages:processing') : t('voucher:deposit:submit')}
                </button>
              </div>
            </div>
            
            {/* 第二行：右侧 - 铸造可认领代金券 */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">{t('voucher:claimableVoucher:title')}</h3>
              </div>
              <div className="card-body space-y-4 flex flex-col" style={{ minHeight: "180px" }}>
                <div className="flex-grow space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('voucher:claimableVoucher:tokenId')}
                    </label>
                    <input 
                      type="number" 
                      value={claimableTokenId} 
                      onChange={(e) => setClaimableTokenId(Number(e.target.value))} 
                      min="1"
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:claimableVoucher:totalAmount')}
                      </label>
                      <input 
                        type="number" 
                        value={claimableAmount} 
                        onChange={(e) => setClaimableAmount(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('voucher:claimableVoucher:claimLimit')}
                      </label>
                      <input 
                        type="number" 
                        value={claimLimit} 
                        onChange={(e) => setClaimLimit(Number(e.target.value))} 
                        min="1"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={mintClaimableVoucher} 
                  disabled={isLoading || isTxProcessing}
                  className="btn btn-primary w-full mt-auto"
                  style={{ backgroundColor: "#000", color: "#fff" }}
                >
                  {isLoading || isTxProcessing ? t('voucher:messages:processing') : t('voucher:claimableVoucher:submit')}
                </button>
              </div>
            </div>
          </div>
          
          {/* 代金券类型列表 */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-medium">{t('voucher:voucherList:title')}</h3>
              <button 
                onClick={loadVoucherTypes} 
                disabled={isLoading}
                className="btn btn-secondary btn-sm"
              >
                {t('voucher:voucherList:actions:refresh')}
              </button>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="spinner"></div>
                </div>
              ) : voucherTypes.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-600">{t('voucher:voucherList:empty')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th>{t('voucher:voucherList:columns:tokenId')}</th>
                        <th>{t('voucher:voucherList:columns:expiry')}</th>
                        <th>{t('voucher:voucherList:columns:maxUsage')}</th>
                        <th>{t('voucher:voucherList:columns:singleUsageLimit')}</th>
                        <th>{t('voucher:voucherList:columns:allowedMerchantTypes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucherTypes.map((type) => (
                        <tr key={type.tokenId} className="hover:bg-gray-50">
                          <td className="font-medium">{type.tokenId}</td>
                          <td>{type.expiry}</td>
                          <td>{type.maxUsage}</td>
                          <td>{type.singleUsageLimit}</td>
                          <td>{type.allowedMerchantTypes.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VoucherManagement;