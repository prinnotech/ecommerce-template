import {
  CircleHelpIcon,
  Columns3Icon,
  GalleryHorizontalIcon,
  LibraryIcon,
  ListFilterIcon,
  MessageSquareQuoteIcon,
  MoveHorizontalIcon,
  RectangleHorizontalIcon,
  ClapperboardIcon,
  HeadingIcon,
  ImagesIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  MailIcon,
  PanelLeftIcon,
  SendIcon,
  SeparatorHorizontalIcon,
  ShapesIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SquareStackIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";

import type { SectionType } from "@repo/core/lib/schemas/theme";

const ICONS: Record<SectionType, LucideIcon> = {
  hero: LayoutTemplateIcon,
  page_header: HeadingIcon,
  rich_text: TypeIcon,
  image_with_text: PanelLeftIcon,
  gallery: ImagesIcon,
  video: ClapperboardIcon,
  product_grid: LayoutGridIcon,
  related_products: ShapesIcon,
  category_tiles: SquareStackIcon,
  trust_badges: ShieldCheckIcon,
  faq: CircleHelpIcon,
  contact_form: MailIcon,
  newsletter: SendIcon,
  spacer: SeparatorHorizontalIcon,
  product_main: ShoppingBagIcon,
  product_list: ListFilterIcon,
  slideshow: GalleryHorizontalIcon,
  marquee: MoveHorizontalIcon,
  collection_list: LibraryIcon,
  multicolumn: Columns3Icon,
  image_banner: RectangleHorizontalIcon,
  testimonials: MessageSquareQuoteIcon,
};

export function SectionIcon({ type, className = "size-4" }: { type: SectionType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={className} aria-hidden />;
}
