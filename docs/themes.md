# Themes and pages

Everything here is in the admin under **Online store**.

## Themes

- **Templates.** Atelier (editorial, the default), Minimal, Bold and Classic. A template sets more than colours: the header layout, the product cards, the hero, which sections the home page starts with, fonts and button style.
- **Library.** Add a template to your library to try it. One theme is **Live**; the others are drafts you can customize, preview, publish, rename, duplicate or delete. Each theme keeps its own changes.
- **Customize** opens the full-screen editor with your store on the right:
  - **Sections:** pick a page (Home, Product page, About, Contact, or one of your pages), then add, remove, reorder (drag or arrows), hide and edit its sections. Text is per language.
  - **Theme settings:** colours for light and dark mode (with a readability warning), fonts, capital headings, corners, buttons, product cards, header layout, contact bar, announcement bar.
  - **Navigation:** the header menu (one level of submenus) and the footer columns. Empty = automatic.
  - Changes save as you type. **Publish** makes the theme live; **Versions** restores one of the last 10 published versions; **Discard changes** goes back to the published version.
- **The product page** has a fixed product block (photos, price, sizes, add to cart). Move it, and add sections above and below it.

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

## Pages

**Online store → Pages** holds your own pages, like a size guide or a lookbook:

- **Create a page:** give it a title. The address follows the title (`/pages/size-guide`), and the page opens in the editor.
- **Settings:** publish or hide the page, change its title or address, and set the search-engine text.
- **Saving:** pages are saved as you type and aren't part of a theme, so switching themes keeps them. A hidden page can only be seen in the editor.
- **Search engines:** published pages are added to the sitemap.

## Images

Every image field has **Upload** (JPG, PNG, WebP or AVIF, up to 10 MB) and **Choose uploaded** to reuse an earlier image. You can also paste the address of an image hosted elsewhere.

## Setup

Set the same `THEME_PREVIEW_SECRET` (any random text, 16+ characters) on the store and the admin. It signs the editor's preview link and the admin's "refresh the store" request after you publish. Without it, the editor still works but shows no preview, and the store picks up changes within 60 seconds.
