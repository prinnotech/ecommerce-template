"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

import { useCookieConsent } from "@repo/core/hooks/use-cookie-consent";
import { trackPageView } from "@repo/core/lib/tracking/browser";
import type { TrackingSettings } from "@repo/core/lib/site-settings";

type TrackingScriptsProps = { tracking: TrackingSettings };

// Google (GTM / Google tag) loads with analytics consent, the Meta Pixel and Google Ads with
// marketing consent. Nothing loads before the visitor chooses in the cookie banner.
export function TrackingScripts({ tracking }: TrackingScriptsProps) {
  const consent = useCookieConsent();
  const is_analytics = Boolean(consent?.analytics);
  const is_marketing = Boolean(consent?.marketing);
  const google_ids = [
    ...(is_analytics && tracking.google_tag_id.startsWith("G-") ? [tracking.google_tag_id] : []),
    ...(is_marketing && tracking.google_tag_id.startsWith("AW-") ? [tracking.google_tag_id] : []),
    ...(is_marketing && tracking.google_ads_conversion ? [tracking.google_ads_conversion.split("/")[0] ?? ""] : []),
  ].filter((id, index, ids) => id && ids.indexOf(id) === index);

  return (
    <>
      {is_analytics && tracking.gtm_id && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(tracking.gtm_id)});`}
        </Script>
      )}
      {google_ids.length > 0 && (
        <>
          <Script
            id="gtag-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(google_ids[0] ?? "")}`}
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${google_ids
              .map((id) => `gtag('config',${JSON.stringify(id)});`)
              .join("")}`}
          </Script>
        </>
      )}
      {is_marketing && tracking.meta_pixel_id && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(tracking.meta_pixel_id)});fbq('track','PageView');`}
        </Script>
      )}
      {(is_analytics || is_marketing) && <PageViewTracker />}
    </>
  );
}

// The tags count the first page themselves; this sends the next ones on client navigation.
function PageViewTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackPageView();
  }, [pathname]);
  return null;
}
