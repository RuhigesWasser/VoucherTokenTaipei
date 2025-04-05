"use client";

import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import React, { useEffect, useState } from "react";
import useMultiBaas from "../hooks/useMultiBaas";
import type { Event } from "@curvegrid/multibaas-sdk";
import { useTranslation } from "../../i18n/client";

interface VoucherEventsProps {
  txReceipt: UseWaitForTransactionReceiptReturnType['data'] | undefined;
}

const VoucherEvents: React.FC<VoucherEventsProps> = ({ txReceipt }) => {
  const { merchant, voucher } = useMultiBaas();
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("全部");

  useEffect(() => {
    setActiveTab(t('events:categories:all'));
  }, [t]);

  const fetchEvents = async () => {
    setIsFetching(true);
    try {
      const [
        merchantEvents, 
        definedEvents, 
        mintedEvents, 
        usedEvents,
        claimedEvents
      ] = await Promise.all([
        merchant.getMintEvents(20),
        voucher.getVoucherDefinedEvents(20),
        voucher.getVoucherMintedEvents(20),
        voucher.getVoucherUsedEvents(20),
        voucher.getVoucherClaimedEvents(20)
      ]);

      const allEvents: Event[] = [
        ...(merchantEvents || []),
        ...(definedEvents || []),
        ...(mintedEvents || []),
        ...(usedEvents || []),
        ...(claimedEvents || [])
      ];

      allEvents.sort((a, b) => 
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
      );

      setEvents(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // 事件分类定义
  const EVENT_CATEGORIES = {
    [t('events:categories:merchant')]: ["Transfer"],
    [t('events:categories:voucher')]: ["VoucherTypeDefined", "VoucherMinted", "VoucherUsed", "VoucherClaimed"],
  };

  // 添加参数名称翻译映射
  const PARAM_NAME_MAP: { [key: string]: string } = {
    tokenId: t('events:fields:tokenId'),
    claimer: t('events:fields:claimer'),
    amount: t('events:fields:amount'),
    merchant: t('events:fields:merchant'),
    consumer: t('events:fields:consumer'),
    expiry: t('events:fields:expiry'),
    maxUsage: t('events:fields:maxUsage'),
    singleUsageLimit: t('events:fields:singleUsageLimit'),
    allowedMerchantTypes: t('events:fields:allowedMerchantTypes'),
    from: t('events:fields:from'),
    to: t('events:fields:to'),
    usageAmount: t('events:fields:usageAmount')
  };

  // 添加值格式化函数
  const formatValue = (name: string, value: any): string => {
    if (name === "expiry") {
      return new Date(Number(value) * 1000).toLocaleString();
    }
    if (name === "amount" || name === "usageAmount" || name === "singleUsageLimit") {
      return `${value} wei`;
    }
    if (name === "allowedMerchantTypes") {
      return Array.isArray(value) ? value.join(", ") : String(value);
    }
    if (typeof value === "boolean") {
      return value ? "是" : "否";
    }
    return String(value);
  };

  // 获取事件信息
  const getEventInfo = (event: Event) => {
    const name = event.event.name;
    let displayName = name;
    let category = t('events:categories:other');
    let bgColor = "bg-gray-100"; // 默认背景色

    // 商户认证事件
    if (name === "Transfer" && event.event.contract.name === "MerchantCertificationToken") {
      displayName = t('events:eventTypes:Transfer');
      category = t('events:categories:merchant');
      bgColor = "bg-blue-100 text-blue-800 hover:bg-blue-200"; // 蓝色背景
    }
    // 代金券事件
    else if (EVENT_CATEGORIES[t('events:categories:voucher')].includes(name)) {
      category = t('events:categories:voucher');
      switch (name) {
        case "VoucherTypeDefined":
        case "VoucherMinted":
          displayName = name === "VoucherTypeDefined" 
            ? t('events:eventTypes:VoucherTypeDefined') 
            : t('events:eventTypes:VoucherMinted');
          bgColor = "bg-rose-100 text-rose-800 hover:bg-rose-200"; // 红色背景（管理事件）
          break;
        case "VoucherUsed":
        case "VoucherClaimed":
          displayName = name === "VoucherUsed" 
            ? t('events:eventTypes:VoucherUsed') 
            : t('events:eventTypes:VoucherClaimed');
          bgColor = "bg-green-100 text-green-800 hover:bg-green-200"; // 绿色背景（消费事件）
          break;
      }
    }
    // 其他所有事件
    else {
      category = t('events:categories:other');
      displayName = name;
    }

    return { displayName, category, bgColor };
  };

  // 固定的分类列表
  const FIXED_CATEGORIES = [
    t('events:categories:all'),
    t('events:categories:merchant'),
    t('events:categories:voucher'),
    t('events:categories:other')
  ];

  // 过滤事件
  const filteredEvents = activeTab === t('events:categories:all')
    ? events 
    : events.filter(event => getEventInfo(event).category === activeTab);

  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-8">{t('events:title')}</h2>

      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap space-x-2">
              {FIXED_CATEGORIES.map(category => (
                <button 
                  key={category}
                  onClick={() => setActiveTab(category)} 
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    activeTab === category 
                      ? "bg-gray-900 text-white" 
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <button 
              onClick={fetchEvents} 
              disabled={isFetching}
              className="btn btn-secondary btn-sm"
            >
              {isFetching ? t('events:messages:processing') : t('events:messages:refresh')}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10 rounded-md">
                <div className="spinner"></div>
              </div>
            )}
            
            {!isFetching && filteredEvents.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">{t('events:messages:noEvents')}</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-gray-100">
                {filteredEvents.map((event, index) => {
                  const { displayName, bgColor } = getEventInfo(event);
                  return (
                    <div key={index} className="pt-4 first:pt-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} mb-2`}>
                            {displayName}
                          </span>
                          <p className="text-sm text-gray-500">{event.triggeredAt}</p>
                        </div>
                        <span className={`text-xs ${bgColor} rounded px-2 py-1`}>
                          {event.transaction.txHash.substring(0, 10)}...
                        </span>
                      </div>
                      
                      <div className="mt-2 bg-gray-50 rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {event.event.inputs.map((input, idx) => (
                            <div key={idx} className="overflow-hidden">
                              <p className="text-xs font-medium text-gray-500 truncate">
                                {PARAM_NAME_MAP[input.name] || input.name}
                              </p>
                              <p className="text-sm truncate">
                                {formatValue(input.name, input.value)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            {t('events:fields:contract')}: <span className="font-mono">{event.event.contract.address}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('events:fields:transaction')}: <a 
                              href={`https://explorer.celo.org/mainnet/tx/${event.transaction.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600"
                            >
                              {event.transaction.txHash}
                            </a>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherEvents;