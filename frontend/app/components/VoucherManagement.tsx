"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import useMultiBaas from "../hooks/useMultiBaas";
import type { UseWaitForTransactionReceiptReturnType } from "wagmi";

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
    <div>
      <h2>代金券管理</h2>
      
      {!isConnected ? (
        <p>请连接钱包以管理代金券</p>
      ) : (
        <>
          <div style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
            <h3>定义新代金券类型</h3>
            <div>
              <label>
                代金券类型ID: 
                <input 
                  type="number" 
                  value={tokenId} 
                  onChange={(e) => setTokenId(Number(e.target.value))} 
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
            <div>
              <label>
                最大使用次数: 
                <input 
                  type="number" 
                  value={maxUsage} 
                  onChange={(e) => setMaxUsage(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <div>
              <label>
                单次使用限额(wei): 
                <input 
                  type="number" 
                  value={singleUsageLimit} 
                  onChange={(e) => setSingleUsageLimit(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <div>
              <label>
                允许的商户类型(逗号分隔): 
                <input 
                  type="text" 
                  value={allowedMerchantTypes} 
                  onChange={(e) => setAllowedMerchantTypes(e.target.value)} 
                />
              </label>
            </div>
            <button 
              onClick={defineVoucherType} 
              disabled={isLoading || isTxProcessing}
            >
              {isLoading || isTxProcessing ? "处理中..." : "定义代金券类型"}
            </button>
          </div>
          
          <div style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
            <h3>铸造代金券</h3>
            <div>
              <label>
                接收地址: 
                <input 
                  type="text" 
                  value={recipientAddress} 
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="留空则使用当前钱包地址" 
                />
              </label>
            </div>
            <div>
              <label>
                代金券类型ID: 
                <input 
                  type="number" 
                  value={mintTokenId} 
                  onChange={(e) => setMintTokenId(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <div>
              <label>
                金额(wei): 
                <input 
                  type="number" 
                  value={mintAmount} 
                  onChange={(e) => setMintAmount(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <button 
              onClick={mintVoucher} 
              disabled={isLoading || isTxProcessing}
            >
              {isLoading || isTxProcessing ? "处理中..." : "铸造代金券"}
            </button>
          </div>
          
          <div style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
            <h3>存入资金</h3>
            <div>
              <label>
                金额(wei): 
                <input 
                  type="number" 
                  value={mintAmount} 
                  onChange={(e) => setMintAmount(Number(e.target.value))} 
                  min="1"
                />
              </label>
            </div>
            <button 
              onClick={depositFunds} 
              disabled={isLoading || isTxProcessing}
            >
              {isLoading || isTxProcessing ? "处理中..." : "存入资金"}
            </button>
          </div>
          
          <div>
            <h3>代金券类型列表</h3>
            <button onClick={loadVoucherTypes} disabled={isLoading}>刷新列表</button>
            
            {isLoading ? (
              <p>加载中...</p>
            ) : voucherTypes.length === 0 ? (
              <p>没有找到代金券类型</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Token ID</th>
                    <th>过期时间</th>
                    <th>最大使用次数</th>
                    <th>单次限额(wei)</th>
                    <th>允许的商户类型</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherTypes.map((type) => (
                    <tr key={type.tokenId}>
                      <td>{type.tokenId}</td>
                      <td>{type.expiry}</td>
                      <td>{type.maxUsage}</td>
                      <td>{type.singleUsageLimit}</td>
                      <td>{type.allowedMerchantTypes.join(', ')}</td>
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

export default VoucherManagement;