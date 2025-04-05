"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import useMultiBaas from "../hooks/useMultiBaas";
import type { UseWaitForTransactionReceiptReturnType } from "wagmi";

interface UserVoucher {
  tokenId: number;
  balance: number;
  usedCount: number;
}

interface VoucherConsumerProps {
  setTxReceipt: (receipt: UseWaitForTransactionReceiptReturnType['data']) => void;
}

const VoucherConsumer: React.FC<VoucherConsumerProps> = ({ setTxReceipt }) => {
  const { voucher, merchant } = useMultiBaas();
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  
  const [userVouchers, setUserVouchers] = useState<UserVoucher[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<`0x${string}`>();
  
  // 使用代金券的状态
  const [useTokenId, setUseTokenId] = useState<number>(1);
  const [useAmount, setUseAmount] = useState<number>(10000000); // 0.01 CELO
  const [merchantAddress, setMerchantAddress] = useState<string>("");
  const [merchantCertId, setMerchantCertId] = useState<number>(1);
  
  const { data: txReceipt, isLoading: isTxProcessing } = useWaitForTransactionReceipt({ hash: txHash });
  
  // 加载用户拥有的代金券
  const loadUserVouchers = async () => {
    if (!address) return;
    
    try {
      setIsLoading(true);
      
      // 查询已定义的代金券类型
      const events = await voucher.getVoucherDefinedEvents(50);
      if (!events || events.length === 0) {
        setIsLoading(false);
        return;
      }
      
      // 从事件中提取所有代金券类型ID
      const tokenIds: number[] = [];
      events.forEach(event => {
        // 从inputs中找到tokenId
        const tokenIdInput = event.event.inputs.find(input => input.name === "tokenId");
        if (tokenIdInput) {
          const tokenId = Number(tokenIdInput.value);
          if (!tokenIds.includes(tokenId)) {
            tokenIds.push(tokenId);
          }
        }
      });

      console.log(tokenIds);
      
      // 查询每种代金券的余额和使用次数
      const userVoucherData: UserVoucher[] = [];
      for (const tokenId of tokenIds) {
        try {
          const balance = await voucher.balanceOf(address, tokenId);
          console.log(balance);
          if (balance && Number(balance) > 0) {
            const usedCount = await voucher.consumptionCount(address, tokenId);
            console.log(usedCount);
            userVoucherData.push({
              tokenId,
              balance: Number(balance),
              usedCount: Number(usedCount || 0)
            });
          }
        } catch (error) {
          console.error(`Error fetching details for token ${tokenId}:`, error);
        }
      }
      
      // 按tokenId排序
      userVoucherData.sort((a, b) => b.tokenId - a.tokenId);
      
      setUserVouchers(userVoucherData);
    } catch (error) {
      console.error("Error loading user vouchers:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 使用代金券
  const useVoucher = async () => {
    if (!isConnected || !address) return;
    
    try {
      setIsLoading(true);
      
      // 验证商户认证
      try {
        const owner = await merchant.ownerOf(merchantCertId);
        if (owner !== merchantAddress) {
          alert('错误: 商户地址不匹配该认证Token');
          setIsLoading(false);
          return;
        }
        
        const isExpired = await merchant.isExpired(merchantCertId);
        if (isExpired) {
          alert('错误: 商户认证已过期');
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        alert('错误: 无效的商户认证Token');
        setIsLoading(false);
        return;
      }
      
      const tx = await voucher.useVoucher(
        useTokenId,
        useAmount,
        merchantAddress,
        merchantCertId
      );
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      // 等待交易确认后重新加载数据
      setTimeout(() => {
        loadUserVouchers();
        setIsLoading(false);
        alert(`代金券使用成功: TokenID ${useTokenId}, 金额 ${useAmount} wei`);
      }, 5000);
    } catch (error: any) {
      console.error("Error using voucher:", error);
      alert(`使用代金券失败: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // 初始加载及钱包连接后加载数据
  useEffect(() => {
    if (isConnected && address) {
      loadUserVouchers();
    }
  }, [isConnected, address]);
  
  // 当交易收据有更新时，通知父组件
  useEffect(() => {
    if (txReceipt && txReceipt.status === 'success') {
      setTxReceipt(txReceipt);
    }
  }, [txReceipt, setTxReceipt]);
  
  return (
    <div>
      <h2>代金券消费</h2>
      
      {!isConnected ? (
        <p>请连接钱包以使用代金券</p>
      ) : (
        <>
          <div style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
            <h3>使用代金券</h3>
            <div>
              <label>
                代金券类型ID: 
                <input 
                  type="number" 
                  value={useTokenId} 
                  onChange={(e) => setUseTokenId(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <div>
              <label>
                使用金额(wei): 
                <input 
                  type="number" 
                  value={useAmount} 
                  onChange={(e) => setUseAmount(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <div>
              <label>
                商户地址: 
                <input 
                  type="text" 
                  value={merchantAddress} 
                  onChange={(e) => setMerchantAddress(e.target.value)}
                  placeholder="输入商户钱包地址" 
                />
              </label>
            </div>
            <div>
              <label>
                商户认证Token ID: 
                <input 
                  type="number" 
                  value={merchantCertId} 
                  onChange={(e) => setMerchantCertId(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <button 
              onClick={useVoucher} 
              disabled={isLoading || isTxProcessing || !merchantAddress}
            >
              {isLoading || isTxProcessing ? "处理中..." : "使用代金券"}
            </button>
          </div>
          
          <div>
            <h3>我的代金券</h3>
            <button onClick={loadUserVouchers} disabled={isLoading}>刷新列表</button>
            
            {isLoading ? (
              <p>加载中...</p>
            ) : userVouchers.length === 0 ? (
              <p>没有找到代金券</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Token ID</th>
                    <th>余额(wei)</th>
                    <th>已使用次数</th>
                  </tr>
                </thead>
                <tbody>
                  {userVouchers.map((voucher) => (
                    <tr key={voucher.tokenId}>
                      <td>{voucher.tokenId}</td>
                      <td>{voucher.balance}</td>
                      <td>{voucher.usedCount}</td>
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

export default VoucherConsumer;