import { MailIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerNoteCard, MarketingConsentCard } from "./components/customer-side-cards";
import { OrderRows } from "@/components/dashboard/order-rows";
import { DetailLayout, SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { getCustomer } from "@repo/core/actions/customers";
import { AddressBlock } from "@repo/core/components/address-block";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { callerShows, requirePermission } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { formatCurrency, formatDate, formatNumber } from "@repo/core/lib/utils/format";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.customers.meta_title);
}

export default async function CustomerPage({ params }: PageProps<"/customers/[key]">) {
  const { key } = await params;
  const lang = await getAdminLocale();
  const caller = await requirePermission("customers.view");
  const can_edit = callerShows(caller, "customers.edit");
  const [dictionary, currency, result] = await Promise.all([
    getAdminDictionary(lang),
    getSiteSetting("CURRENCY"),
    getCustomer(key),
  ]);
  if (!result.ok) {
    if (result.error === "not_found") notFound();
    throw new Error(result.error);
  }
  const customer = result.data;
  const text = dictionary.customers;
  const money = (cents: number) => formatCurrency(cents, customer.currency || currency, lang);

  const stats = [
    { label: text.stats.orders, value: formatNumber(customer.order_count, lang) },
    { label: text.stats.spent, value: money(customer.total_spent) },
    { label: text.stats.average, value: customer.average_order ? money(customer.average_order) : "—" },
    { label: text.stats.last_order, value: customer.last_order_at ? formatDate(customer.last_order_at, lang) : "—" },
  ];

  return (
    <Page
      title={customer.name || customer.email}
      title_meta={
        <StatusBadge tone={customer.is_registered ? "info" : "neutral"}>
          {customer.is_registered ? text.types.registered : text.types.guest}
        </StatusBadge>
      }
      subtitle={
        customer.is_registered
          ? text.since.replace("{date}", formatDate(customer.created_at, lang))
          : text.guest_since.replace("{date}", formatDate(customer.created_at, lang))
      }
      back={{ href: "/customers", label: text.title }}
    >
      <DetailLayout
        main={
          <>
            <SectionCard>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
            <SectionCard title={text.orders_title} is_flush>
              {customer.orders.length === 0 ? (
                <p className="text-muted-foreground px-4 pb-4 text-sm">{text.no_orders}</p>
              ) : (
                <OrderRows
                  lang={lang}
                  orders={customer.orders}
                  dictionary={dictionary.orders_admin}
                  order_status={dictionary.order_status}
                  payment_status={dictionary.payment_status}
                  is_compact
                  show_customer={false}
                />
              )}
            </SectionCard>
          </>
        }
        sidebar={
          <>
            <SectionCard title={text.contact_title}>
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href={`mailto:${customer.email}`}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 break-all"
                >
                  <MailIcon className="size-4 shrink-0" aria-hidden />
                  {customer.email}
                </a>
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <PhoneIcon className="size-4 shrink-0" aria-hidden />
                    {customer.phone}
                  </a>
                )}
                {customer.is_registered && (
                  <span className="text-muted-foreground text-xs">
                    {customer.is_verified ? text.email_verified : text.email_not_verified}
                  </span>
                )}
              </div>
            </SectionCard>

            <SectionCard title={text.addresses_title}>
              <div className="flex flex-col gap-4">
                {customer.addresses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{text.no_addresses}</p>
                ) : (
                  customer.addresses.map((address, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      {address.is_default && (
                        <StatusBadge tone="neutral" has_dot={false}>
                          {text.default_address}
                        </StatusBadge>
                      )}
                      <AddressBlock address={address} lang={lang} />
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            {customer.is_registered && (
              <MarketingConsentCard
                user_id={customer.key}
                accepts_marketing={customer.accepts_marketing}
                can_edit={can_edit}
                dictionary={text}
                errors={dictionary.errors}
              />
            )}

            <CustomerNoteCard
              customer_key={customer.key}
              can_edit={can_edit}
              dictionary={text}
              errors={dictionary.errors}
            />
          </>
        }
      />
    </Page>
  );
}
