"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import useMultiBaas from "../hooks/useMultiBaas";
import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import { useTranslation } from "../../i18n/client";

interface MerchantCert {
  tokenId: number;
  merchantType: number;
  expiry: string;
  owner: string;
}

interface MerchantCertificationProps {
  setTxReceipt: (receipt: UseWaitForTransactionReceiptReturnType['data']) => void;
}

const MerchantCertification: React.FC<MerchantCertificationProps> = ({ setTxReceipt }) => {
  const { merchant } = useMultiBaas();
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { t } = useTranslation();
  
  const [merchantAddress, setMerchantAddress] = useState<string>("");
  const [merchantTypeId, setMerchantTypeId] = useState<number>(1);
  const [expirationDays, setExpirationDays] = useState<number>(30);
  const [tokenId, setTokenId] = useState<number>(1);
  const [certifications, setCertifications] = useState<MerchantCert[]>([]);
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const { data: txReceipt, isLoading: isTxProcessing } = useWaitForTransactionReceipt({ hash: txHash });
  
  // 加载认证历史
  const loadCertifications = async () => {
    try {
      setIsLoading(true);
      const events = await merchant.getMintEvents(50);
      if (!events || events.length === 0) {
        setCertifications([]);
        setIsLoading(false);
        return;
      }
      
      // 只使用事件获取tokenId列表
      const tokenIds: number[] = [];
      events.forEach(event => {
        // 检查是否是Transfer事件，且from地址为0地址（铸造）
        if (event.event.name === "Transfer" && 
            event.event.inputs.find(input => 
              input.name === "from" && 
              input.value === "0x0000000000000000000000000000000000000000"
            )) {
          // 从inputs中找到tokenId
          const tokenIdInput = event.event.inputs.find(input => input.name === "tokenId");
          if (tokenIdInput) {
            const tokenId = Number(tokenIdInput.value);
            if (!tokenIds.includes(tokenId)) {
              tokenIds.push(tokenId);
            }
          }
        }
      });
      
      // 查询每个证书的详细信息
      const certs: MerchantCert[] = [];
      for (const tokenId of tokenIds) {
        try {
          // 使用Promise.all优化多个合约调用
          const [owner, merchantType, expiryTime] = await Promise.all([
            merchant.ownerOf(tokenId),
            merchant.merchantTypeId(tokenId),
            merchant.expirationTime(tokenId)
          ]);

          if (!owner) continue;
          
          certs.push({
            tokenId,
            merchantType: Number(merchantType),
            expiry: new Date(Number(expiryTime) * 1000).toLocaleString(),
            owner: owner as string
          });
        } catch (error) {
          console.error(`Error fetching details for token ${tokenId}:`, error);
        }
      }
      
      // 按tokenId排序
      certs.sort((a, b) => b.tokenId - a.tokenId);
      
      setCertifications(certs);
    } catch (error) {
      console.error("Error loading certifications:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 创建新的商户认证
  const mintCertification = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      // 计算过期时间（当前时间 + 天数）
      const expiryTime = Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60);
      
      const tx = await merchant.mintCertification(
        merchantAddress || address!, // 如果未指定地址，使用当前钱包地址
        merchantTypeId,
        expiryTime
      );
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      // 等待交易确认后重新加载数据
      setTimeout(() => {
        loadCertifications();
      }, 5000);
    } catch (error) {
      console.error("Error minting certification:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 撤销认证
  const revokeCertification = async (tokenId: number) => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const tx = await merchant.revokeCertification(tokenId);
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      // 等待交易确认后重新加载数据
      setTimeout(() => {
        loadCertifications();
      }, 5000);
    } catch (error) {
      console.error("Error revoking certification:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 初始加载及钱包连接后加载数据
  useEffect(() => {
    if (isConnected) {
      loadCertifications();
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
      <h2 className="text-2xl font-semibold mb-8">{t('merchant:title')}</h2>
      
      {!isConnected ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-600 mb-4">{t('merchant:messages:connectWallet')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">{t('merchant:form:merchantType')}</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('merchant:form:recipientAddress')}
                  </label>
                  <input 
                    type="text" 
                    value={merchantAddress} 
                    onChange={(e) => setMerchantAddress(e.target.value)}
                    placeholder={t('merchant:placeholder:useCurrentAddress')} 
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('merchant:form:merchantTypeId')}
                  </label>
                  <input 
                    type="number" 
                    value={merchantTypeId} 
                    onChange={(e) => setMerchantTypeId(Number(e.target.value))} 
                    min="1"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('merchant:form:expirationDays')}
                  </label>
                  <input 
                    type="number" 
                    value={expirationDays} 
                    onChange={(e) => setExpirationDays(Number(e.target.value))} 
                    min="1"
                    className="w-full"
                  />
                </div>
                <button 
                  onClick={mintCertification} 
                  disabled={isLoading || isTxProcessing}
                  className="btn btn-primary w-full"
                >
                  {isLoading || isTxProcessing ? t('merchant:messages:processing') : t('merchant:actions:mint')}
                </button>
              </div>
            </div>
            
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">{t('merchant:form:certificationTokenId')}</h3>
              </div>
              <div className="card-body">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('merchant:form:certificationTokenId')}
                    </label>
                    <input 
                      type="number" 
                      value={tokenId} 
                      onChange={(e) => setTokenId(Number(e.target.value))} 
                      min="1"
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => loadCertifications()}
                      className="btn btn-secondary"
                    >
                      {t('merchant:actions:refresh')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="text-lg font-medium">{t('merchant:table:columns:tokenId')}</h3>
              <div className="text-sm text-gray-500">
                {certifications.length} {t('merchant:table:count')}
              </div>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="spinner"></div>
                </div>
              ) : certifications.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-600">{t('merchant:table:empty')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th>{t('merchant:table:columns:tokenId')}</th>
                        <th>{t('merchant:table:columns:merchantAddress')}</th>
                        <th>{t('merchant:table:columns:merchantType')}</th>
                        <th>{t('merchant:table:columns:expiry')}</th>
                        <th>{t('merchant:table:columns:actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certifications.map((cert) => (
                        <tr key={cert.tokenId}>
                          <td className="font-medium">{cert.tokenId}</td>
                          <td className="text-gray-500 truncate max-w-xs">{cert.owner}</td>
                          <td>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {t('merchant:form:merchantType')} {cert.merchantType}
                            </span>
                          </td>
                          <td>{cert.expiry}</td>
                          <td>
                            <button 
                              onClick={() => revokeCertification(cert.tokenId)}
                              disabled={isLoading || isTxProcessing}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                            >
                              {t('merchant:actions:revoke')}
                            </button>
                          </td>
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

export default MerchantCertification;