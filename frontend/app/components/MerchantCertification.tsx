"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import useMultiBaas from "../hooks/useMultiBaas";
import type { UseWaitForTransactionReceiptReturnType } from "wagmi";

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
    <div>
      <h2>商户认证管理</h2>
      
      {!isConnected ? (
        <p>请连接钱包以管理商户认证</p>
      ) : (
        <>
          <div style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
            <h3>创建新认证</h3>
            <div>
              <label>
                商户地址: 
                <input 
                  type="text" 
                  value={merchantAddress} 
                  onChange={(e) => setMerchantAddress(e.target.value)}
                  placeholder="留空则使用当前钱包地址" 
                />
              </label>
            </div>
            <div>
              <label>
                商户类型ID: 
                <input 
                  type="number" 
                  value={merchantTypeId} 
                  onChange={(e) => setMerchantTypeId(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <div>
              <label>
                有效期(天): 
                <input 
                  type="number" 
                  value={expirationDays} 
                  onChange={(e) => setExpirationDays(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <button 
              onClick={mintCertification} 
              disabled={isLoading || isTxProcessing}
            >
              {isLoading || isTxProcessing ? "处理中..." : "创建认证"}
            </button>
          </div>
          
          <div>
            <h3>查询认证</h3>
            <div>
              <label>
                认证Token ID: 
                <input 
                  type="number" 
                  value={tokenId} 
                  onChange={(e) => setTokenId(Number(e.target.value))} 
                  min="1"
                />
              </label>
              <button onClick={() => loadCertifications()}>刷新列表</button>
            </div>
          </div>
          
          <div>
            <h3>认证列表</h3>
            {isLoading ? (
              <p>加载中...</p>
            ) : certifications.length === 0 ? (
              <p>没有找到认证记录</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Token ID</th>
                    <th>商户地址</th>
                    <th>商户类型</th>
                    <th>过期时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((cert) => (
                    <tr key={cert.tokenId}>
                      <td>{cert.tokenId}</td>
                      <td>{cert.owner}</td>
                      <td>{cert.merchantType}</td>
                      <td>{cert.expiry}</td>
                      <td>
                        <button 
                          onClick={() => revokeCertification(cert.tokenId)}
                          disabled={isLoading || isTxProcessing}
                        >
                          撤销
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MerchantCertification;