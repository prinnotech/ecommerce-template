import { BanknoteIcon, RotateCcwIcon, ShieldCheckIcon, TruckIcon, type LucideIcon } from "lucide-react";

import type { Dictionary } from "@repo/core/lib/i18n";
import { hasCashOnDelivery } from "@repo/core/lib/payment-methods";
import type { SiteSettings } from "@repo/core/lib/site-settings";
import { formatCurrency } from "@repo/core/lib/utils/format";

type Badge = { Icon: LucideIcon; title: string; body: string };

// Reassurance messages built from settings, so they're always true for this store.
export function trustBadges(settings: SiteSettings, dictionary: Dictionary["store"]["trust"], lang: string): Badge[] {
  const rates = settings.SHIPPING_RATES;
  const min_days = Math.min(...rates.map((rate) => rate.min_days));
  const max_days = Math.max(...rates.map((rate) => rate.max_days));
  const badges: Badge[] = [];

  if (settings.FREE_SHIPPING_THRESHOLD > 0) {
    badges.push({
      Icon: TruckIcon,
      title: dictionary.free_shipping_title,
      body: dictionary.free_shipping_body.replace(
        "{amount}",
        formatCurrency(settings.FREE_SHIPPING_THRESHOLD, settings.CURRENCY, lang),
      ),
    });
  } else {
    badges.push({
      Icon: TruckIcon,
      title: dictionary.delivery_title,
      body: dictionary.delivery_body.replace("{min}", String(min_days)).replace("{max}", String(max_days)),
    });
  }
  if (settings.RETURNS_DAYS > 0) {
    badges.push({
      Icon: RotateCcwIcon,
      title: dictionary.returns_title,
      body: dictionary.returns_body.replace("{days}", String(settings.RETURNS_DAYS)),
    });
  }
  if (hasCashOnDelivery(settings)) {
    badges.push({ Icon: BanknoteIcon, title: dictionary.cod_title, body: dictionary.cod_body });
  }
  badges.push({ Icon: ShieldCheckIcon, title: dictionary.secure_title, body: dictionary.secure_body });
  return badges;
}

export function TrustBadges({ badges }: { badges: Badge[] }) {
  return (
    <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      {badges.map(({ Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-muted-foreground text-sm">{body}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
