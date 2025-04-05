"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import useMultiBaas from "../hooks/useMultiBaas";
import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import VoucherTooltip from "./VoucherTooltip";

interface UserVoucher {
  tokenId: number;
  balance: number;
  usedCount: number;
}

interface ClaimableVoucher {
  tokenId: number;
  claimLimit: number;
  availableAmount: number;
}

interface VoucherType {
  tokenId: number;
  expiry: string;
  maxUsage: number;
  singleUsageLimit: string;
  allowedMerchantTypes: number[];
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
  
  // 弹窗状态
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // 添加可认领代金券的状态
  const [claimableVouchers, setClaimableVouchers] = useState<ClaimableVoucher[]>([]);
  
  // 添加代金券类型信息状态
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  
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
  
  // 加载可认领的代金券列表
  const loadClaimableVouchers = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const vouchers = await voucher.getClaimableVouchers();
      if (vouchers) {
        setClaimableVouchers(vouchers);
      }
    } catch (error) {
      console.error("Error loading claimable vouchers:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 加载代金券类型信息
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
  
  // 打开使用代金券弹窗
  const openUseVoucherModal = (tokenId: number) => {
    setUseTokenId(tokenId);
    setShowModal(true);
  };
  
  // 关闭使用代金券弹窗
  const closeUseVoucherModal = () => {
    setShowModal(false);
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
        setShowModal(false); // 关闭弹窗
        alert(`代金券使用成功: TokenID ${useTokenId}, 金额 ${useAmount} wei`);
      }, 5000);
    } catch (error: any) {
      console.error("Error using voucher:", error);
      alert(`使用代金券失败: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // 认领代金券
  const claimVoucher = async (tokenId: number) => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      const tx = await voucher.claimVoucher(tokenId);
      
      const hash = await sendTransactionAsync(tx);
      setTxHash(hash);
      
      setTimeout(() => {
        loadClaimableVouchers();
        loadUserVouchers();
        setIsLoading(false);
        alert(`代金券认领成功：TokenID ${tokenId}`);
      }, 5000);
    } catch (error) {
      console.error("Error claiming voucher:", error);
      setIsLoading(false);
    }
  };
  
  // 查找代金券类型详情
  const getVoucherTypeInfo = (tokenId: number) => {
    return voucherTypes.find(type => type.tokenId === tokenId);
  };
  
  // 修改初始加载的 useEffect
  useEffect(() => {
    if (isConnected && address) {
      loadUserVouchers();
      loadClaimableVouchers();
      loadVoucherTypes(); // 加载代金券类型信息
    }
  }, [isConnected, address]);
  
  // 当交易收据有更新时，通知父组件
  useEffect(() => {
    if (txReceipt && txReceipt.status === 'success') {
      setTxReceipt(txReceipt);
    }
  }, [txReceipt, setTxReceipt]);
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-8">代金券消费</h2>
      
      {!isConnected ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center shadow-sm">
          <p className="text-gray-600 mb-4">请连接钱包以使用代金券</p>
        </div>
      ) : (
        <div className="flex flex-row space-x-4">
          {/* 左侧 - 可认领代金券 */}
          <div className="w-1/2">
            <div className="card mb-8" style={{ height: 'calc(100vh - 150px)', overflow: 'auto' }}>
              <div className="card-header flex justify-between items-center">
                <h3 className="text-lg font-medium">可认领代金券</h3>
                <button 
                  onClick={loadClaimableVouchers} 
                  disabled={isLoading}
                  className="btn btn-secondary btn-sm"
                >
                  刷新列表
                </button>
              </div>
              <div className="card-body">
                {isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="spinner"></div>
                  </div>
                ) : claimableVouchers.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <p className="text-gray-600">当前没有可认领的代金券</p>
                  </div>
                ) : (
                  <div>
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="py-3">Token ID</th>
                          <th className="py-3">可认领数量(wei)</th>
                          <th className="py-3">剩余总量(wei)</th>
                          <th className="py-3">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claimableVouchers.map((voucher) => {
                          const voucherType = getVoucherTypeInfo(voucher.tokenId);
                          return (
                            <tr key={voucher.tokenId}>
                              <td className="font-medium py-3">
                                {voucherType ? (
                                  <VoucherTooltip data={voucherType}>
                                    {voucher.tokenId}
                                  </VoucherTooltip>
                                ) : (
                                  voucher.tokenId
                                )}
                              </td>
                              <td className="py-3">{voucher.claimLimit}</td>
                              <td className="py-3">{voucher.availableAmount}</td>
                              <td className="py-3">
                                <button
                                  onClick={() => claimVoucher(voucher.tokenId)}
                                  disabled={isLoading || isTxProcessing}
                                  className="btn btn-primary btn-sm"
                                >
                                  认领
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 右侧 - 我的代金券 */}
          <div className="w-1/2">
            <div className="card mb-8" style={{ height: 'calc(100vh - 150px)', overflow: 'auto' }}>
              <div className="card-header flex justify-between items-center">
                <h3 className="text-lg font-medium">我的代金券</h3>
                <button 
                  onClick={loadUserVouchers} 
                  disabled={isLoading}
                  className="btn btn-secondary btn-sm"
                >
                  刷新列表
                </button>
              </div>
              <div className="card-body">
                {isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="spinner"></div>
                  </div>
                ) : userVouchers.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-gray-600">没有找到代金券</p>
                  </div>
                ) : (
                  <div>
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="py-3">Token ID</th>
                          <th className="py-3">余额(wei)</th>
                          <th className="py-3">已使用次数</th>
                          <th className="py-3">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userVouchers.map((voucher) => {
                          const voucherType = getVoucherTypeInfo(voucher.tokenId);
                          return (
                            <tr key={voucher.tokenId}>
                              <td className="font-medium py-3">
                                {voucherType ? (
                                  <VoucherTooltip data={voucherType}>
                                    {voucher.tokenId}
                                  </VoucherTooltip>
                                ) : (
                                  voucher.tokenId
                                )}
                              </td>
                              <td className="py-3">{voucher.balance}</td>
                              <td className="py-3">{voucher.usedCount}</td>
                              <td className="py-3">
                                <button
                                  onClick={() => openUseVoucherModal(voucher.tokenId)}
                                  className="btn btn-primary btn-sm"
                                >
                                  使用代金券
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 使用代金券弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">使用代金券</h3>
              <button 
                onClick={closeUseVoucherModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  代金券类型ID
                </label>
                <input 
                  type="number" 
                  value={useTokenId} 
                  disabled
                  className="w-full bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  使用金额(wei)
                </label>
                <input 
                  type="number" 
                  value={useAmount} 
                  onChange={(e) => setUseAmount(Number(e.target.value))} 
                  min="1"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  商户地址
                </label>
                <input 
                  type="text" 
                  value={merchantAddress} 
                  onChange={(e) => setMerchantAddress(e.target.value)}
                  placeholder="输入商户钱包地址" 
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  商户认证Token ID
                </label>
                <input 
                  type="number" 
                  value={merchantCertId} 
                  onChange={(e) => setMerchantCertId(Number(e.target.value))} 
                  min="1"
                  className="w-full"
                />
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button 
                  onClick={closeUseVoucherModal}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button 
                  onClick={useVoucher} 
                  disabled={isLoading || isTxProcessing || !merchantAddress}
                  className="btn btn-primary"
                >
                  {isLoading || isTxProcessing ? "处理中..." : "确认使用"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherConsumer;