"use client";

import type { UseWaitForTransactionReceiptReturnType } from "wagmi";
import React, { useEffect, useState } from "react";
import useMultiBaas from "../hooks/useMultiBaas";
import type { Event } from "@curvegrid/multibaas-sdk";

interface VoucherEventsProps {
  txReceipt: UseWaitForTransactionReceiptReturnType['data'] | undefined;
}

const VoucherEvents: React.FC<VoucherEventsProps> = ({ txReceipt }) => {
  const { merchant, voucher } = useMultiBaas();
  const [events, setEvents] = useState<Event[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("全部");

  const fetchEvents = async () => {
    setIsFetching(true);
    try {
      const [merchantEvents, definedEvents, mintedEvents, usedEvents] = await Promise.all([
        merchant.getMintEvents(20),
        voucher.getVoucherDefinedEvents(20),
        voucher.getVoucherMintedEvents(20),
        voucher.getVoucherUsedEvents(20)
      ]);

      const allEvents: Event[] = [
        ...(merchantEvents || []),
        ...(definedEvents || []),
        ...(mintedEvents || []),
        ...(usedEvents || [])
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
    "商户认证": ["Transfer"],
    "代金券": ["VoucherTypeDefined", "VoucherMinted", "VoucherUsed"],
  };

  // 获取事件信息
  const getEventInfo = (event: Event) => {
    const name = event.event.name;
    let displayName = name;
    let category = "其他";

    // 商户认证事件
    if (name === "Transfer" && event.address === merchant.address) {
      displayName = "商户认证授予";
      category = "商户认证";
    }
    // 代金券事件
    else if (EVENT_CATEGORIES["代金券"].includes(name)) {
      category = "代金券";
      switch (name) {
        case "VoucherTypeDefined":
          displayName = "代金券类型定义";
          break;
        case "VoucherMinted":
          displayName = "代金券铸造";
          break;
        case "VoucherUsed":
          displayName = "代金券使用";
          break;
      }
    }
    // 其他所有事件
    else {
      category = "其他";
      displayName = name; // 保持原始事件名
    }

    return { displayName, category };
  };

  // 固定的分类列表
  const FIXED_CATEGORIES = ["全部", "商户认证", "代金券", "其他"];

  // 过滤事件
  const filteredEvents = activeTab === "全部" 
    ? events 
    : events.filter(event => getEventInfo(event).category === activeTab);

  return (
    <div className="container">
      <h1 className="title">Recent Events</h1>
      <div style={{ marginBottom: '15px' }}>
        {FIXED_CATEGORIES.map(category => (
          <button 
            key={category}
            onClick={() => setActiveTab(category)} 
            style={{ 
              fontWeight: activeTab === category ? 'bold' : 'normal', 
              marginRight: '10px',
              padding: '5px 10px',
              backgroundColor: activeTab === category ? '#e0e0e0' : 'transparent'
            }}
          >
            {category}
          </button>
        ))}
      </div>
      <button 
        onClick={fetchEvents} 
        disabled={isFetching}
        style={{ marginBottom: '15px' }}
      >
        {isFetching ? 'Loading...' : 'Refresh Events'}
      </button>
      <div className="spinner-parent">
        {isFetching && (
          <div className="overlay">
            <div className="spinner"></div>
          </div>
        )}
        {!isFetching && filteredEvents.length === 0 ? (
          <p>No events found.</p>
        ) : (
          <ul className="events-list">
            {filteredEvents.map((event, index) => (
              <li key={index} className="event-item">
                <div className="event-name">
                  <strong>{getEventInfo(event).displayName}</strong> - {event.triggeredAt}
                </div>
                <div className="event-details">
                  {event.event.inputs.map((input, idx) => (
                    <p key={idx}>
                      <strong>{input.name}:</strong> {input.value}
                    </p>
                  ))}
                  <p>
                    <strong>Transaction Hash:</strong> {event.transaction.txHash}
                  </p>
                  <p>
                    <strong>Contract:</strong> {event.address}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default VoucherEvents;