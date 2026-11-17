# Themes and pages

Everything here is in the admin under **Online store**.

## Themes

- **Templates.** Atelier (editorial, the default), Minimal, Bold and Classic. A template sets more than colours: the header layout, the product cards, the hero, which sections the home page starts with, fonts and button style.
- **Library.** Add a template to your library to try it. One theme is **Live**; the others are drafts you can customize, preview, publish, rename, duplicate or delete. Each theme keeps its own changes.
- **Customize** opens the full-screen editor with your store on the right, laid out like Shopify's:
  - **Top bar:** the page you're editing (Home, Product page, Shop & collections, About, Contact, or one of your pages), desktop/phone view, the preview language, **Undo / Redo** (also Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z), Versions and **Publish**.
  - **Sections tab:** an outline of the page in three parts: **Header** (Announcement bar, Header), the page's own sections, and **Footer**. Click one to edit it, with **Back** to return to the outline.
    - **Add section** opens a searchable list with a short description of each section.
    - Each section's **⋯** menu moves it up or down, **duplicates** it, or removes it; the eye hides it; drag to reorder.
    - Every section has a **colour scheme**: Page colours, Soft surface, Inverted or Accent colour. They come from the theme's colours, so they work in light and dark mode.
  - **The preview is live:** hover a section to see its name, click it to open its settings; choosing a section in the sidebar scrolls the preview to it.
  - **Theme settings:** colours for light and dark mode (with a readability warning), fonts, capital headings, corners, buttons and product cards.
  - **Navigation:** the header menu (one level of submenus) and the footer columns. Empty = automatic.
  - Changes save as you type. **Publish** makes the theme live; **Versions** restores one of the last 10 published versions; **Discard changes** goes back to the published version.
- **Header and footer** are the same on every page:
  - **Announcement bar:** one or more messages (with optional links) shown one at a time with arrows, changing every few seconds (0 = only with the arrows). With no messages it shows the free-shipping message when free shipping is on.
  - **Header:** logo (empty = the logo from Settings → General, or the store name) and its width, layout, stays at the top while scrolling, contact bar.
  - **Footer:** newsletter sign-up, social links, copyright line. Its columns and links are in the Navigation tab.
- **Fixed blocks:** the product page has the product block (photos, price, sizes, add to cart) and **Shop & collections** has the product list (filters, sorting, pages; choose 3 or 4 columns and whether the Shop shows the filter sidebar). Move them and add sections above and below them; they can't be removed.

## Sections

| Section | What it shows |
|---|---|
| Hero | Big heading, subtitle, up to two buttons, optional image |
| Page title | Small text, title and subtitle at the top of a page |
| Text | Paragraphs (a blank line starts a new one; lines starting with `- ` make a list) |
| Image with text | An image beside a heading, text and button |
| Image gallery | 2–12 images with captions and optional links |
| Video | A YouTube or Vimeo link, or a video file address |
| Product grid | Featured, newest, or one category's products |
| You may also like | Product page only: products from the same category |
| Category tiles | Chosen categories, or the first top-level ones |
| Trust badges | Shipping, returns, cash on delivery and secure checkout, built from your settings |
| FAQ | Questions and answers that open on click |
| Contact form | The contact form, with your contact details beside it |
| Newsletter | An email sign-up; sign-ups arrive in Messages |
| Spacer | Empty space, optionally with a line |
| Slideshow | Up to 8 full-width slides with a heading, text and button, changing on their own |
| Image banner | A wide image with a heading, text and button on top; set its height and how dark the image gets |
| Scrolling text | Short phrases scrolling across the page (slow, medium or fast; small or large) |
| Multicolumn | 2–4 columns, each with an image, heading, text and link |
| Collection list | Chosen collections as image tiles |
| Testimonials | Customer quotes with a name and stars |
| Product list | Shop & collections only: the products, filters and pages (fixed) |

## Pages

**Online store → Pages** holds your own pages, like a size guide or a lookbook:

- **Create a page:** give it a title. The address follows the title (`/pages/size-guide`), and the page opens in the editor.
- **Settings:** publish or hide the page, change its title or address, and set the search-engine text.
- **Saving:** pages are saved as you type and aren't part of a theme, so switching themes keeps them. A hidden page can only be seen in the editor.
- **Search engines:** published pages are added to the sitemap.

## Images

Every image field has **Upload** (JPG, PNG, WebP or AVIF, up to 10 MB) and **Choose uploaded** to reuse an earlier image. You can also paste the address of an image hosted elsewhere.

## Setup

Nothing to configure: the editor's live preview and the "refresh the store" request after a publish are signed with a key both apps derive from the backend secret. To choose the key yourself, set the same `THEME_PREVIEW_SECRET` (any random text, 16+ characters) on the store and the admin.
