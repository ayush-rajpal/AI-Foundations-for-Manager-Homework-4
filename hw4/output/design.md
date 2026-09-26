# Campus Customs — Website Design Updates

## Update 1: Neutral, consistent framing for product photos

**What has been improved.** Product photos come with their own black or white backgrounds (73 black, 29 white), so on the product cards, especially on the Home page, they looked like mismatched squares pasted onto the card. Every photo now sits in the same soft slate frame (`#f1f5f9`) with even padding, rounded inner corners, and a faint shadow, like a mounted print. Black and white photos now read as one consistent set. The same framing is used on the Products page, the product page's large image, and the small product cards in the chat, and photos zoom slightly when a card is hovered.

**How it helps customers stick around and buy.** A consistent, polished product grid looks trustworthy and premium, which matters for officially licensed apparel at $32–$98. When the eye isn't distracted by mismatched backgrounds, customers can compare products at a glance and focus on the garment itself, making it easier to browse longer, find something they like, and feel confident enough to buy it.

## Update 2: Handsome Dan on the chat button

**What has been improved.** The chat button and chat window header no longer say "Chatbot - How can I help?". They show a round avatar of Handsome Dan, Yale's bulldog, next to a simple "How can I help?". The avatar is a photo cropped to a circle on his face, loaded from `frontend/public/handsome-dan.jpg`. Until that photo is added, an illustration drawn from the reference photo is shown: white bulldog, brown ears, navy sweater, and a bow tie with a white "Y" pattern. The avatar tilts slightly when the button is hovered.

**How it helps customers stick around and buy.** A friendly, familiar mascot makes the assistant feel like part of the Yale community rather than a generic bot, so customers are more likely to click it and ask a question. Customers who get quick answers about sizes, stock, and alternatives are more likely to find the right item and complete the purchase.

## Update 3: Filters open from a "Filters" button

**What has been improved.** The filter sidebar is no longer always on the side of the Products page. A **Filters** button above the products (with a badge showing how many filters are on) opens the filter panel on the left. Clicking **Hide filters** closes it again, so the products use the full width: five per row instead of three. Filters stay applied while the panel is closed, the active-filter chips stay visible above the results, and the open/closed choice is remembered during the visit.

**How it helps customers stick around and buy.** Shoppers who just want to browse see more products at once, with nothing in the way. Shoppers who want to narrow down are one click from every filter. A cleaner page makes it easier to spot something they like, and fewer distractions keep attention on the products.

## Update 4: Fixed placeholder product details

**What has been improved.** Three products showed placeholder text instead of real details: "Campus Customs product photo (…). Vision blocked; filename-based stub." They were the **Benjamin Franklin T Shirt**, the **Berkeley Sweater Fleece Jacket**, and the **Timothy Dwight College Crewneck**, and they also had no colors, generic tags, and vague garment types. Each now has a real description written from its photo, its garment color (all three are heather gray) and crest colors, specific tags (e.g. "Berkeley College", "residential college"), and a proper garment type. No other products had this problem. The fix runs automatically when the backend starts (`backend/catalogue_fixes.py`), so it also repairs a fresh copy of the database.

**How it helps customers stick around and buy.** Placeholder text looks broken and makes a store feel untrustworthy at the exact moment a customer is deciding. Real descriptions and colors let customers understand what they're buying. These products now also show up in color filters, color searches, and chatbot answers, where they were invisible before.

## Update 5: A search bar that understands how customers talk

**What has been improved.** The search bar used to treat every word as a keyword, so "hody under $90" found **0 items**: "under" and "90" had to appear in a product. It now understands everyday shopping phrases and turns them into filters:
- **Prices:** "under $90", "less than 60", "over $70", "between 30 and 40", "$50-$60", "around $70".
- **Sizes:** "in medium", "size XL", "2XL"; shows only products in stock in that size.
- **Colors:** "navy hoodie", "gray crewneck", even misspelled ("nvy", "gry"). These match the garment color, not logo colors.
- **Sorting:** "cheapest …" and "most expensive …".
- **Filler words:** "I want", "something for my…", "show me" are ignored.

The results line shows how the search was understood, e.g. **"hoodie" · under $90**. When nothing matches everything, the search loosens one part at a time and says so, instead of showing an empty page: "Nothing comes in black right now. Showing other colors instead.", "Nothing matches under $30. Showing the lowest prices first." "hody under $90" now finds all 27 hoodies, and "nvy hudy in large under $70" finds the 11 navy hoodies in stock in L under $70.

**How it helps customers stick around and buy.** Customers can type the way they think ("xl tees under 35", "something for my mom") and get exactly what they asked for, instead of an empty page that makes the store look like it doesn't carry the item. Every search leads to products they can actually buy, in their size and budget, which shortens the path from searching to checkout.

## Update 6: Save favorites with a star

**What has been improved.** Every product card and product page now has a **star** button to save it as a favorite. On cards, the star is a clean outlined circle next to **Add to cart**, below the photo rather than floating over its corner; it fills gold when saved. Starred items are saved to the customer's account in the database (new `favorites` table), so they're still there the next time the customer logs in, on any device. A **Favorites** link in the navigation bar (with a count badge) opens a page of everything they've starred, and tapping the star again removes it. If a guest taps a star, they're taken to Log in; afterwards the item is starred automatically and they return to where they were. The Favorites link uses the same font and style as the other navigation links.

**How it helps customers stick around and buy.** Customers can shortlist items while browsing ("I like these three hoodies") and come back to decide later, instead of losing them and giving up. Saved favorites give a reason to create an account and return to the site, and returning shoppers with a ready shortlist are much closer to buying.

## Update 7: Add to cart, on the website and through the chatbot

**What has been improved.** Customers can now add products to a **shopping cart** saved to their account (new `cart_items` table):
- **On a product page:** pick a size, choose a quantity, and click **Add to cart · $price**. Sold-out sizes can't be selected, and you can't add more than is in stock.
- **On any product card** (Home, Products, Favorites, chat results): **Add to cart** opens a **size pop-up** with the product's photo, price, and color, and a size grid showing stock for each size ("In stock", "Only 2 left" in amber, "Sold out" crossed out and disabled). It also has a quantity picker, a **Size guide** link, and a black **×** in the top right (Escape or a click outside also closes it). Adding closes the pop-up and the card shows "✓ Added M" with a **View cart** link.
- **Cart page and nav badge:** a **Cart** link in the navigation bar shows the item count and opens the Cart page. There, customers can change quantities, remove items, and see the subtotal. Online checkout isn't available yet, so the page says so.
- **Through the chatbot:** customers can say "add the Saybrook College Crewneck in medium to my cart". The chatbot has new `add_to_cart` and `view_cart` tools. It asks for a size if none was given, confirms what it added with the cart total, and refuses sold-out sizes (and suggests an in-stock alternative instead). It asks guests to log in first. The cart badge on the site updates as soon as the chatbot adds something.
- **Saved:** the cart is still there after logging out and back in.

**How it helps customers stick around and buy.** Adding to a cart is the step from "I like this" to "I'm buying this", and now it takes one click, or one sentence in the chat. Customers can collect several items, including sizes the chatbot helped them find, and come back to their saved cart later instead of starting over. That keeps them moving toward purchase instead of leaving.

## Update 8: US size guide

**What has been improved.** Customers can now check their size before buying. A **Size guide** link sits next to "Sizes" on every product page and opens a pop-up. The same guide is inside the Add to cart size pop-up on product cards. It's a **US size chart**: chest, waist, and neck measurements in inches for XS–XXL, plus what each size usually fits in US men's and women's sizing. It also gives tips on how to measure, notes that styles are cut unisex (men's sizing), and says to size up for a relaxed fit. The size the customer has selected is highlighted in the chart. It's labeled as a general guide, since the catalogue has no measurements for individual products.

**How it helps customers stick around and buy.** Not knowing which size to pick is one of the main reasons shoppers hesitate or abandon apparel purchases, especially for gifts ("what size is my dad?"). A clear US chart right where they choose a size gives them the confidence to add to cart, and choosing the right size the first time means fewer returns and exchanges.
