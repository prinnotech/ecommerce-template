import { MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";

import { countryName } from "@repo/core/lib/locale/countries";
import type { SiteSettings } from "@repo/core/lib/site-settings";

type ContactDetailsProps = {
  settings: SiteSettings;
  lang: string;
  labels: { email: string; phone: string; whatsapp: string; address: string; follow: string };
};

// Store contact details from site settings; missing ones are simply not shown.
export function ContactDetails({ settings, lang, labels }: ContactDetailsProps) {
  const contact = settings.SITE_CONTACT;
  const address = settings.STORE_ADDRESS;
  const address_lines = [
    address.street,
    [address.postal_code, address.city, address.region].filter(Boolean).join(" "),
    address.country ? countryName(address.country, lang) : "",
  ].filter(Boolean);
  const socials = Object.entries(settings.SOCIAL_LINKS).filter(([, url]) => url);
  const whatsapp_number = contact.whatsapp.replace(/\D/g, "");

  const rows = [
    contact.email && { Icon: MailIcon, label: labels.email, value: contact.email, href: `mailto:${contact.email}` },
    contact.phone && {
      Icon: PhoneIcon,
      label: labels.phone,
      value: contact.phone,
      href: `tel:${contact.phone.replace(/\s+/g, "")}`,
    },
    whatsapp_number && {
      Icon: MessageCircleIcon,
      label: labels.whatsapp,
      value: contact.whatsapp,
      href: `https://wa.me/${whatsapp_number}`,
    },
  ].filter((row) => Boolean(row)) as { Icon: typeof MailIcon; label: string; value: string; href: string }[];

  return (
    <div className="flex flex-col gap-6 text-sm">
      {rows.map(({ Icon, label, value, href }) => (
        <div key={label} className="flex items-start gap-3">
          <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{label}</span>
            <a
              href={href}
              className="font-medium underline-offset-4 hover:underline"
              {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {value}
            </a>
          </div>
        </div>
      ))}
      {address_lines.length > 0 && (
        <div className="flex items-start gap-3">
          <MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{labels.address}</span>
            <address className="font-medium not-italic">
              {address_lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
        </div>
      )}
      {socials.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{labels.follow}</span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {socials.map(([network, url]) => (
              <li key={network}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium capitalize hover:underline"
                >
                  {network}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
