"use client";

import { useEffect } from "react";

import { trackGoogleAdsConversion, trackGoogleEvent, trackMetaEvent } from "@repo/core/lib/tracking/browser";

type PurchaseTrackerProps = {
  // The checkout session id: the server's Purchase event uses the same id.
  event_id: string;
  order_number: number;
  value: number;
  currency: string;
  content_ids: string[];
  google_ads_conversion: string;
};

// Fires the browser Purchase once per order (a reload of the thank-you page doesn't count again).
export function PurchaseTracker(props: PurchaseTrackerProps) {
  useEffect(() => {
    const key = `purchase_tracked:${props.event_id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: the event may be counted again on a reload; Meta dedupes by event_id.
    }
    const value = props.value / 100;
    trackMetaEvent(
      "Purchase",
      { currency: props.currency, value, content_ids: props.content_ids, content_type: "product" },
      props.event_id,
    );
    trackGoogleEvent("purchase", {
      transaction_id: String(props.order_number),
      value,
      currency: props.currency,
    });
    trackGoogleAdsConversion({
      send_to: props.google_ads_conversion,
      value,
      currency: props.currency,
      transaction_id: String(props.order_number),
    });
  }, [props]);
  return null;
}

// Product page view and add to cart (Meta + Google).
export function trackProductView(product: { id: string; value: number; currency: string; title: string }): void {
  trackMetaEvent("ViewContent", {
    content_ids: [product.id],
    content_type: "product",
    value: product.value / 100,
    currency: product.currency,
  });
  trackGoogleEvent("view_item", {
    currency: product.currency,
    value: product.value / 100,
    items: [{ item_id: product.id, item_name: product.title }],
  });
}

export function trackAddToCart(product: {
  id: string;
  value: number;
  currency: string;
  title: string;
  quantity: number;
}): void {
  trackMetaEvent("AddToCart", {
    content_ids: [product.id],
    content_type: "product",
    value: (product.value * product.quantity) / 100,
    currency: product.currency,
  });
  trackGoogleEvent("add_to_cart", {
    currency: product.currency,
    value: (product.value * product.quantity) / 100,
    items: [{ item_id: product.id, item_name: product.title, quantity: product.quantity }],
  });
}
