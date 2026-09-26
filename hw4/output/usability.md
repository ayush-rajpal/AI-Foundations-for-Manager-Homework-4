# Campus Customs — Usability Improvements

## Front-end usability improvements

### Update 1: Standardized colors, and only the primary color shown

**The problem.** The catalogue's `colors` field mixed two different things in one list: the color of the garment itself, followed by the colors of its logo or graphics. The website showed the whole list, so a heather gray Morse Logo T Shirt appeared as "Colors: Heather Gray, White, Black, Red". A customer could reasonably think the shirt comes in four colors, or that it's available in black. The same color was also spelled two ways ("Navy" and "Navy Blue"), so identical garments looked different.

**What changed.**

| | Before | After |
|---|---|---|
| Product card | Colors: Heather Gray, White, Black, Red | Color: Heather Gray |
| Product page | (colors row removed earlier) | Color: Heather Gray |
| Color names | "Navy" on 13 products, "Navy Blue" on 31 | "Navy Blue" on all 44 |
| Database | one `colors` list | `primary_color` (garment) + `secondary_colors` (logo / graphics); original `colors` kept |
| Chatbot | "does it come in black?" could be misread from the logo colors | answers from the garment color: "No, the Morse Logo T Shirt is heather gray, not black. It does have black details in the Morse College logo." |
| Color search | a "navy" search also matched gray hoodies with navy lettering | matches the garment color only: 17 navy blue hoodies |

**How it helps customers.**

- **No false expectations.** Customers see the color of the item they will actually receive, so they don't order a gray shirt thinking it's black.
- **Faster decisions.** One color per card is quicker to scan than a list of four, especially when comparing many products on the Products page.
- **Consistent names.** "Navy Blue" everywhere means two navy hoodies look like the same color, because they are.
- **Honest chatbot answers.** The assistant says an item is heather gray with a black logo, instead of implying it comes in black.
- **Better search.** Asking for "navy hoodies" returns navy hoodies, not gray ones with navy text.

**How it helps the business.**

- **Fewer returns and complaints.** Wrong-color expectations are a common cause of returns and exchanges in apparel; showing the true garment color reduces them.
- **Higher conversion.** Clear, consistent product information builds trust and removes a reason to hesitate at the point of purchase.
- **Fewer support questions.** Customers don't need to ask the store (or the chatbot) "which color is it really?".
- **Cleaner data for the future.** Separate garment and logo colors make it possible to add reliable color filters, merchandising ("shop all heather gray"), and inventory reports later. Standardizing names means reports don't split one color into two.
- **Easy to maintain.** New color variants can be merged by adding one line to `COLOR_NAMES` in `backend/main.py`; the split and renaming run automatically at startup.

**Where it lives.**

| Part | File |
|---|---|
| Database split and color renaming (runs at startup) | `backend/main.py` → `split_colors()`, `standardize_colors()`, `COLOR_NAMES` |
| API fields `primary_color`, `secondary_colors` | `backend/main.py` → `product_from_row()`; `backend/models.py` → `ProductCard` |
| Product card shows one color | `frontend/src/components/ProductCard.tsx` |
| Product page "Color" row | `frontend/src/pages/ProductDetail.tsx` |
| Chatbot color rules | `backend/prompts/prompt.md` → *Product colors* |
| Search filter on garment color | `backend/tools.py` → `search_products` |

**Tested.** Every product card on the Products page shows a single color (Navy Blue 44, Heather Gray 41, and a few others); the 3 products with no color listed show none. The Boola Boola T Shirt page reads "Color: Navy Blue". "navy" and "navy blue" searches both return the same 17 hoodies. The database was backed up before the change.

### Update 2: Filters (product type, color, price) and sorting by price

**The problem.** The Products page had only a search box and single-choice category buttons. A customer looking for, say, a navy hoodie or T-shirt under $70 had to scroll through all 102 products or run several separate searches. There was no way to pick more than one type or color, no way to set a budget, and no way to see the cheapest or most expensive items first.

**What changed.** The Products page now has a filter sidebar and a sort menu.

| Feature | How it works |
|---|---|
| **Product type** (multi-select) | Checkboxes for Hoodies, Crewnecks, T-Shirts, Quarter-Zips, Jackets & Fleece, Long Sleeve. Pick any combination, e.g. Hoodies + T-Shirts. |
| **Color** (multi-select) | Checkboxes with a color swatch for each garment color (Navy Blue, Heather Gray, Cream, …), most common first. Uses the primary color from Update 1, so a gray shirt with a navy logo isn't listed as navy. |
| **Price slider** | A two-handle slider from the cheapest ($32) to the most expensive ($98) product. Drag either handle; the handles can't cross. |
| **Manual min / max** | Min and Max boxes under the slider, synced with it both ways. Type a price and press Enter (or click away) to move the handle. Values outside $32–$98 are pulled back into range, and a min above the max is swapped automatically. |
| **Sort** | "Sort by" menu: Featured (A to Z), **Price: Low to High**, **Price: High to Low**. Ties are ordered by name. |
| **Live counts** | Each option shows how many products it would give with the other filters applied, e.g. with Hoodies chosen, "Navy Blue 17" (17 navy blue hoodies). Options that would give 0 are dimmed. |
| **Active-filter chips** | Chosen filters appear above the results (e.g. "Hoodies ×", "Navy Blue ×", "$45.00 – $70.00 ×"). Click one to remove it, or **Clear all**. Each group also has its own **Clear** link. |
| **No results** | "No products match these filters" with a **Clear all filters** button, instead of an empty page. |
| **Shareable links** | Filters and sort are saved in the page address, e.g. `/products?type=Hoodies&color=navy+blue&min=45&max=70&sort=price-asc`, so a view can be bookmarked, shared, or restored with the back button. |
| **Phones** | On small screens the sidebar folds away behind a **Filters (3)** button showing how many filters are on. |
| **Search + collections** | The search box and Home page collections (Residential Colleges, Varsity Sports, …) still work and combine with the filters. |
| **Chatbot** | When exactly one product type is selected, the chatbot is told the customer is browsing that category (page context from Problem 8). |

**How it helps customers.**

- **Find the right item fast.** Two or three clicks narrow 102 products to the handful that match their type, color, and budget.
- **Shop within a budget.** The slider and exact min/max boxes let them see only what they're willing to spend, with no surprises at the product page.
- **Compare easily.** Sorting by price puts the cheapest (or premium) options first, useful for gift buyers and students.
- **No dead ends.** Live counts show what's available before clicking, dimmed options warn that a choice would give nothing, and chips make it easy to undo one filter without starting over.
- **Works on phones.** The folding filter panel keeps the product grid front and center on small screens, where many students shop.

**How it helps the business.**

- **Higher conversion.** Customers who can quickly find a matching item are more likely to buy it than those who give up scrolling.
- **Bigger baskets and better upsell.** Filtering by type and color surfaces related items side by side (e.g. navy hoodies and navy crewnecks), and "Price: High to Low" showcases premium pieces like the $98 fleece jackets.
- **Budget shoppers aren't lost.** Parents, visitors, and students with a price in mind can filter to it instead of leaving the site.
- **Shareable views.** Staff, social posts, or emails can link straight to a filtered view, e.g. "all navy hoodies under $70".
- **Insight later.** Filter choices live in the URL, so if analytics are added, the store can see which colors, types, and price points customers look for most.
- **Relies on clean data.** The color filter depends on Update 1: without separating garment and logo colors, filtering by color would show the wrong products.

**Where it lives.**

| Part | File |
|---|---|
| Filter state, URL reading/writing, filtering, sorting, color swatches | `frontend/src/productFilters.ts` |
| Filter sidebar (type, color, price groups with counts and Clear links) | `frontend/src/components/ProductFilters.tsx` |
| Two-handle price slider with Min / Max boxes | `frontend/src/components/PriceRangeSlider.tsx` |
| Toolbar (search, Filters button, Sort menu), chips, results | `frontend/src/pages/Products.tsx` |
| Styles, including the phone layout | `frontend/src/index.css` (*Products page: filters, sort, price slider*) |
| Chatbot page context for a selected type | `frontend/src/components/ChatWidget.tsx` |

**Tested** (in the browser, on the live catalogue).

| Action | Result |
|---|---|
| No filters | 102 items; slider and boxes show $32 – $98 |
| Product type: Hoodies | 27 items |
| + T-Shirts | 52 items (27 + 25) |
| + Color: Navy Blue | 22 items |
| Typed Min 40 (click away) and Max 65 (Enter) | 1 item, the $45 Ua Gameday Double Knit Hood (navy hoodies cost $68, navy tees $32); slider handles moved to 40 and 65 |
| Sort: Price: Low to High / High to Low (all products) | prices in order: $32 first, $98 last / $98 first |
| Dragged the max handle to 60 | 58 items, none over $58; Max box updated to 60 |
| Dragged the min handle past the max | stops at the max (handles can't cross) |
| Typed Min 90, Max 50 | swapped to 50 – 90 |
| Clear all | back to 102 items |
| Phone width (375 px) | filters hidden behind "Filters (3)"; tapping it opens them; no sideways scrolling |
| Console errors | none; production build passes |

**Fix: search box understands plurals and synonyms.** Testing found that searching "hoodies" returned **0 items**: the search box matched the exact text typed, and products say "Hoodie" or "hooded sweatshirt", never "hoodies". The search box now uses the same word matching as the chatbot's search:

- **Plurals:** "hoodies", "bulldogs", "jackets" match hoodie, bulldog, jacket.
- **Synonyms:** "tees" / "t shirt" / "t-shirts" → T-shirts; "1/4 zip" / "quarter zip" → quarter-zips; "hooded" / "hood" → hoodies; "grey" → gray; "Handsome Dan" → bulldog designs.
- **Type words match the type, not descriptions:** "crewnecks" or "long sleeve" only match a product's name, garment type, or category, so a T-shirt described with a "crew-neck collar" or a sweatshirt with "long sleeves" isn't included.
- **Partial words:** results update while typing ("hood" already shows the hoodies).

| Search | Before | After |
|---|---|---|
| hoodies | 0 | 27 |
| tees | 0 | 25 |
| 1/4 zips | 0 | 11 |
| crewnecks | 0 | 31 (the 29 crewnecks, the "Creqneck" field hockey crewneck, and one crew-neck tee) |
| long sleeve | 44 (any product whose description mentions long sleeves) | 2 (the two long-sleeve shirts) |
| handsome dan | 0 | 10 |
| grey | 0 | 50 |
| saybrook crewneck | 1 | 1 (unchanged; already worked) |

*Why it matters:* customers type naturally, usually in the plural ("hoodies", "tees"). A search that returns nothing for the store's best-selling category looks like the store doesn't sell it, and the customer leaves. Matching how people actually type keeps them shopping. (Code: `frontend/src/productFilters.ts` → `searchTokens`, `productTokens`, `TYPE_WORDS`.)

### Update 3: Search understands spelling mistakes

**The problem.** Customers often type quickly on a phone or aren't sure how a word is spelled ("hudy", "swetshirt", "saybrok"). The search box only matched real catalogue words, so a single typo returned **0 items**, which looks exactly like "we don't sell that".

**What changed.** When a search word doesn't match any word in the catalogue, the search finds the catalogue word the customer most likely meant and searches for that instead. A line above the results says how the search was understood, e.g. **Showing results for "hoodie"** (you typed "hudy"), so the customer knows what happened and can retype if it guessed wrong.

It uses two checks; either is enough:

| Check | What it catches | Examples |
|---|---|---|
| **Close spelling** | 1–3 letters added, missing, wrong, or swapped (1 for words up to 5 letters, 2 up to 8, 3 for longer). 3-letter words must also start with the right letter. | tshrit → t-shirt, crewnek → crewneck, jaket → jacket, flece → fleece, gren → green, nvy → navy |
| **Sounds alike** | Same first letter and the same consonants in order, for words of 4+ letters. Catches phonetic spellings that are many letters off. | **hudy → hoodie** (both reduce to "h-d"), sweter → sweater, cruneck → crewneck |

Rules that keep it from over-correcting:

- **Real words are never changed.** "navy", "red", "grey", "tees" search as typed.
- **Half-typed words aren't "fixed".** "hood" or "sayb" still show results as you type, instead of jumping to a guess.
- **Nonsense still returns nothing.** "zzzz" or "xqwv" give 0 items rather than a random guess.
- **Spelling is fixed before phrases are recognized,** so "quartr zip" becomes "quarter zip" and finds the quarter-zips, and "hansome dan" becomes Handsome Dan and finds the bulldog designs.
- It works together with the plurals and synonyms from Update 2 ("hudys" → hoodies) and with all the filters and sorting.

The chatbot already handled typos, because the AI model corrects them before it searches: "do you have any hudys?" put all 27 hoodies on the page, and "show me swetshirts from saybrok" found the Saybrook College Crewneck.

**How it helps customers.**

- **No dead ends from a typo.** Misspelling a word still leads to the right products instead of an empty page.
- **Faster on phones.** Customers don't have to go back and fix small typing mistakes on a small keyboard.
- **Easier for everyone.** Visitors, parents, and international students who aren't sure of a spelling ("Saybrook", "crewneck") still find what they want.
- **Clear and honest.** "Showing results for …" shows exactly what was searched, so a wrong guess is easy to spot.

**How it helps the business.**

- **Fewer lost sales.** A "0 results" page is one of the most common reasons shoppers leave an online store; turning typos into results keeps them shopping.
- **Search looks smarter.** The site behaves like the big retail sites customers are used to, which builds trust.
- **Works on the store's own words.** The corrections come from the live catalogue (product names, colleges, colors, garment types), so new products and names are picked up automatically, with no list of misspellings to maintain.
- **Fast and free.** It runs in the customer's browser in milliseconds, with no extra server or AI cost.

**Where it lives.**

| Part | File |
|---|---|
| Spelling distance, sounds-alike check, closest-word lookup | `frontend/src/spelling.ts` → `editDistance`, `skeleton`, `closestWord` |
| Catalogue vocabulary, fixing the query before searching | `frontend/src/productFilters.ts` → `vocabulary`, `interpretQuery`, `PHRASE_WORDS` |
| "Showing results for …" line | `frontend/src/pages/Products.tsx`, styles in `frontend/src/index.css` (`.spelling-note`) |

**Tested** (in the browser, on the live catalogue).

| Typed | Understood as | Results |
|---|---|---|
| hudy / hudys / hoody / hoddie | hoodie | 27 (all hoodies) |
| nvy hudy | navy hoodie | 25 |
| tshrit / teeshirt | t-shirt | 25 |
| swetshirt | sweatshirt | 38 |
| sweter | sweater | 6 |
| crewnek / cruneck | crewneck | 31 |
| quartr zip / quater zip | quarter-zip | 11 |
| long sleve | long sleeve | 2 |
| jaket | jacket | 8 |
| flece | fleece | 9 |
| bulldgo | bulldog | 10 |
| handsom dan / hansome dan | bulldog (Handsome Dan) | 10 |
| saybrok / sabrook | saybrook | 3 |
| gren | green | 4 |
| blak | black | 9 |
| navy, red, grey, tees, hoodies | unchanged (real words) | 80, 9, 50, 25, 27 |
| hood, sayb (half-typed) | unchanged | 27, 3 |
| zzzz, xqwv | no guess | 0 |

Production build passes.


### Update 4: Movable, resizable chat window

**The problem.** The chat panel was fixed in the bottom-right corner at one size. On the Products page it covered product cards and the filter sidebar, on a product page it covered the size table, and long replies with product cards felt cramped. Customers couldn't move it out of the way or make it bigger.

**What changed** (on screens 640 px and wider):

| Action | How |
|---|---|
| **Move** | Drag the chat header (the blue bar) anywhere on the screen. The cursor shows a move icon. |
| **Resize** | Drag any corner. The bottom-right corner has a visible grip; the other corners work too, and the opposite corner stays in place. |
| **Keyboard** | Tab to the header, then **arrow keys** move the window and **Shift + arrow keys** resize it (20 px per press). |
| **Reset** | Click the **⤢** button in the header, or double-click the header, to put it back in the bottom-right corner at the default size. |
| **Remembered** | Position and size are saved in the browser, so the chat opens where the customer left it, even after a refresh. |
| **Always usable** | The window can't be dragged off screen or made smaller than 300 × 360 px, and it's pulled back on screen if the browser window gets smaller. |
| **Phones** | Under 640 px wide it stays a fixed panel that fits the screen, since there's no room to move it; no drag or resize handles are shown. |

Clicking the header's buttons (Reset, Close) never starts a drag, and the chat itself (messages, product cards, sending) works exactly as before.

**How it helps customers.**

- **See the page and the chat together.** Move the chat next to the product grid, filters, or a product's size table instead of covering them.
- **Room to read.** Make the window bigger for long answers and product cards, or smaller to keep it out of the way.
- **Their layout, remembered.** The chat reopens where they put it.
- **Accessible.** Works with a mouse or the keyboard, and a one-click reset if it ends up in an odd place.

**How it helps the business.**

- **More engagement with the chatbot.** A chat that doesn't get in the way stays open longer, and customers are more likely to keep asking questions while they browse.
- **The chat and the page work together.** The chatbot fills the page with search results (Problem 7) and suggests alternatives (Backend Update 1); a movable window lets customers compare those results with the page side by side, which supports buying decisions.
- **Fewer abandoned sessions.** Customers don't have to close the chat (and lose their place) just to see what's behind it.
- **Front-end only.** It's pure browser code, with no extra server or AI cost.

**Where it lives.**

| Part | File |
|---|---|
| Move / resize / keyboard / reset / remember logic | `frontend/src/components/useFloatingWindow.ts` |
| Chat panel wiring (header drag, corner handles, reset button) | `frontend/src/components/ChatWidget.tsx` |
| Styles (move cursor, corner grips, drag shadow) | `frontend/src/index.css` → *Chat window: movable and resizable* |

**Tested** (browser at 1280 × 850).

| Action | Result |
|---|---|
| Open chat | bottom-right, 400 × 600 |
| Drag header 300 px left, 200 px up | moved to (556, 26); same size; "moving" style shown while dragging |
| Drag bottom-right corner +100 × +50 | 500 × 650 |
| Drag top-left corner inward 80 px | 420 × 570; bottom-right corner stayed in place |
| Drag a corner far inward | stops at the 300 × 360 minimum |
| Drag header far off screen | stays fully on screen |
| Arrow Left ×2, Arrow Up | moved 40 px left and 20 px up |
| Shift + Arrow Down ×2 | 40 px taller |
| Reset button | back to bottom-right, 400 × 600; saved position cleared |
| Reload with a saved position (120, 140, 460 × 520) | reopened at exactly that position and size |
| Phone width (375 px), after reload | fixed panel that fits the screen; no handles or reset button |
| Production build | passes |

---

## Backend / chatbot usability improvements

### Update 1: Never just "no": the chatbot suggests alternatives

**The problem.** When a customer asked for something the store doesn't have, the chatbot answered honestly but stopped there: "No, the Basic Hoodie Big Yale isn't available in black." or "Sorry, we don't carry gym shorts." A bare "no" ends the conversation, and the customer has to start searching again on their own, or leaves.

**What changed.** Whenever something isn't available, the chatbot now says so clearly **and** suggests 2–4 real, in-stock alternatives, each with a short reason, shown as clickable product cards. It works in three layers:

| Layer | What it does | File |
|---|---|---|
| **New tool: `find_alternatives`** | Given what the customer wanted (the product they asked about, and the color, size, type, budget, or keywords that failed), it finds the closest **in-stock** products. It starts with products matching everything, then loosens one requirement at a time (keywords → color → type → size → budget). It ranks by similar design (same college or sport), **nearest color** (black → charcoal, dark heather gray, then navy blue), closest to the budget, and closest price. Each suggestion comes with a reason, e.g. "pullover hoodie in charcoal gray; same price; differs: color black". | `backend/tools.py` → `find_alternatives`; types in `backend/models.py` → `Alternative`, `AlternativesResult` |
| **Prompt rule: "Never just say no"** | Covers every "not available" case (wrong color, sold-out size, no search results, over budget, item the store doesn't sell). The agent must: say the no in one short sentence, call `find_alternatives`, suggest 2–4 alternatives with why each fits, and show them as cards. For items the store doesn't sell, it looks for the closest thing it does sell (shorts → sports T-shirts). | `backend/prompts/prompt.md` → *Never just say no: always offer alternatives* |
| **Automatic check** | If a tool reported in this turn that something isn't available (a sold-out size, or a search with no results) and the reply doesn't include at least one **other** product, the reply is rejected and the agent must add alternatives. So a bare "no" can't reach the customer. | `backend/agent.py` → `check_reply`, `_unavailable` |

Alternatives only ever come from the database: they're in stock, and their prices are checked by the existing price rule.

**Before and after** (tested with the live agent; "Before" answers are from earlier test runs in this project, "—" means that question wasn't tried before this change):

| Customer asks | Before | After |
|---|---|---|
| "is this available in black?" (on the Basic Hoodie Big Yale page) | "No, the Basic Hoodie Big Yale comes in navy blue and white, not black." | "**Sorry, the Basic Hoodie Big Yale isn't available in black**, it comes in navy blue." Then the closest dark options: **District Vit Hoodie Vintage Sailor Bulldog** (charcoal gray, $68), **District Vit Hoodie Vintage Bulldog** (dark heather gray, $68), **Champion Full Zip Hood** (charcoal gray, $88). |
| "do you have the Saybrook College Crewneck in XXL?" | "Sorry, size XXL is sold out… Sizes XS, S, M, L, and XL are still in stock." | Same honest answer, **plus** XXL alternatives at the same $58: Davenport, Grace Hopper, Jonathan Edwards, and Timothy Dwight College Crewnecks, all in stock in XXL. |
| "got any gym shorts?" | "Sorry, Campus Customs doesn't carry gym shorts." | "We don't carry gym shorts. The closest athletic options…" 4 Yale sports T-shirts (field hockey, baseball, basketball, football) at $32 with sizes in stock. |
| "do you have pink hoodies?" | — | "**Sorry, we don't currently have any pink hoodies.**" Then 4 hoodies at $68 in navy blue, heather gray, and dark heather gray, with sizes. |
| "anything under $25?" | — | "**Sorry, nothing is currently under $25.** The closest options are Yale T-shirts at **$32**…" (the store's cheapest items). |
| "do you sell baseball caps?" | — | "We don't carry baseball caps, but we do have Yale baseball apparel": baseball T-shirt ($32), crewneck ($58), and hoodie ($68). |

**How it helps customers.**

- **A helpful next step, not a dead end.** Every "no" comes with things they *can* buy, so they keep shopping instead of starting over.
- **Relevant suggestions.** Alternatives stay close to what they wanted: the nearest color, the same college or sport, the same price, in stock in their size.
- **Honest and clear.** The no still comes first, in bold, so customers aren't misled; each alternative says how it differs ("charcoal gray, not black").
- **One click away.** Alternatives appear as product cards in the chat, linking straight to the product page.

**How it helps the business.**

- **Saves sales that would be lost.** An out-of-stock or "we don't have that" moment is where shoppers usually leave; offering a close substitute turns many of those into purchases.
- **Moves inventory.** Suggestions only include in-stock items, and prefer products with more stock, steering demand away from sold-out sizes toward what's on the shelf.
- **Cross-sells.** A customer asking for a baseball cap discovers the baseball T-shirt, crewneck, and hoodie; someone with a small budget is shown the $32 tees.
- **Consistent service.** The automatic check guarantees every customer gets alternatives, not just when the AI happens to think of it, the way a good sales associate always offers "we don't have it in black, but have you seen this one?".
- **Demand signals for later.** Requests like "black hoodies", "pink", or "shorts" show what customers want that the store doesn't stock yet, useful for future buying decisions if the chats are reviewed.

**Also fixed along the way.** The word "shorts" used to match "short-sleeve" T-shirts in the chatbot's search, so "gym shorts" looked like an exact match. "short-sleeve" is now treated as one word (`backend/tools.py`, `_PHRASES`).

**Refinement after testing.** Testing Update 1 on the Baseball Left Chest Crewneck page ("do we have this in black?") showed two problems with the first version:

1. **It restated what the customer could already see:** "Sorry, the Baseball Left Chest Crewneck is navy blue, not black. It has a white YALE BASEBALL wordmark." The customer is looking at the product, so that sentence adds nothing.
2. **It suggested an alternative that was sold out in the customer's size** (the District Vit Crewneck Vintage Bulldog, sold out in S).

What changed (`backend/prompts/prompt.md` → *Never just say no*):

- **The no is about what they asked for, and about the whole store.** The agent now says whether *any* product of that type comes in that color: "**Sorry, this crewneck isn't available in black, and we don't have any black crewnecks right now.**" If other products of that type do come in the color, it says so instead: "We do have other hoodies in that color:".
- **No restating.** No sentence describing the product's own color or logo after the no.
- **Friendly lead-in:** "Here are some alternatives you might like:". The agent does **not** call them popular or best-sellers, because the database has no sales data to back that up (the prompt's safety rules forbid inventing facts).
- **Size-aware alternatives.** If the customer's size is known from the conversation, the agent passes it to `find_alternatives`, so every suggestion is in stock in that size, and it doesn't list sizes an alternative is sold out in.

| Test (gpt-6-luna) | Reply |
|---|---|
| Baseball Left Chest Crewneck page: "do we have this in black?" | "**Sorry, this crewneck isn't available in black, and we don't have any black crewnecks right now.**" + 3 dark-gray crewnecks at $58 |
| Same, after the customer asked about size S | Same opening, then 3 crewnecks **in stock in S** (Yale Sports Crewneck Baseball: 20 left, Champion Mens Triumph Raglan Crew: 15, Squash Left Chest Tennis: 20); the District Vit crewneck (0 in S) is no longer suggested |
| Basic Hoodie Big Yale page: "is this available in heather gray?" | "**Sorry, the Basic Hoodie Big Yale isn't available in heather gray.** We do have other hoodies in that color:" + 3 heather gray hoodies ($68), with no "It's a navy blue hoodie." |
| Boola Boola T Shirt page: "do you have this in size L?" | "**Sorry, size L is sold out**… Sizes XS, S, M, XL, and XXL are still in stock." + 4 T-shirts in stock in L |

**Model upgrade.** The chatbot now runs on **gpt-6-luna** (previously gpt-5.6-luna), through the same Portkey key; Portkey serves it as `gpt-6-luna-global`. All the tests above were run on gpt-6-luna. Switching is a one-line change: `MODEL_NAME` in `backend/agent.py`.

**Refinement: alternatives stay in the same or a similar category.** In the first version, `find_alternatives` gave up the product type early (right after color), so a customer asking for a navy hoodie under $50 in M could be offered navy T-shirts. A customer who wants a hoodie wants a hoodie.

What changed (`backend/tools.py` → `find_alternatives`, `_RELATED_CATEGORIES`; `backend/prompts/prompt.md` step 3):

- **The type is loosened last.** Requirements are now dropped in this order: keywords → color → budget → **type** → size → **any type**. So the tool will show a hoodie in another color, or slightly over budget, before it shows something that isn't a hoodie.
- **Similar categories before unrelated ones.** When the same type has nothing in stock that fits, it moves to a related type first, and only then to anything else:

  | Customer wants | Related types tried next |
  |---|---|
  | Hoodies | Crewnecks, Quarter-Zips, Jackets & Fleece |
  | Crewnecks | Hoodies, Quarter-Zips |
  | Quarter-Zips | Crewnecks, Jackets & Fleece, Hoodies |
  | Jackets & Fleece | Quarter-Zips, Hoodies |
  | T-Shirts | Long Sleeve |
  | Long Sleeve | T-Shirts, Crewnecks |

- **Same type ranks first.** Within any set of results, products of the same type come before related types.
- **The agent is told to keep to the same kind of item** and to always pass the `product_id` or `category`, so the tool knows what type to stay in.

("—" means that case wasn't tested before this change.)

| Test | Before | After |
|---|---|---|
| Tool: navy hoodie, size M, under $50 | 2 hoodies + 2 **T-shirts** | 4 **hoodies** (1 exact match, then a heather gray one and two slightly over budget) |
| Tool: long-sleeve shirt in XS (both long-sleeve shirts are sold out in XS) | — | related types only: 2 T-shirts and a long-sleeve crewneck, all in XS |
| Agent, Baseball Left Chest Crewneck page: "do we have this in black?" | 3 crewnecks (first version) | 3 **crewnecks** in the darkest shades (dark heather charcoal, heather charcoal gray, dark heather gray) |
| Agent: "do you have a navy hoodie in medium for under $50?" | — | "Yes! **Ua Gameday Double Knit Hood** is a navy blue hoodie for **$45**, and medium is in stock." (a real match, so no alternatives needed) |
| Agent: "do you have a long sleeve shirt in XS?" | — | no XS long sleeves, so XS options from the related types: a long-sleeve crewneck and 2 T-shirts |

*Why it matters:* an alternative is only useful if it's the kind of item the customer came for. Keeping suggestions in the same category makes them feel like a real "try this instead", which is far more likely to turn into a sale than an unrelated product.

**Refinement: never recommend something that's sold out in the customer's size.** Testing showed the chatbot could still suggest an alternative that was sold out in the size the customer needed (e.g. the District Vit Crewneck Vintage Bulldog, which has 0 in size S, to a customer shopping for S). The prompt already said not to; now the code guarantees it.

What changed (`backend/agent.py` → `check_reply`, `_customer_size`; `backend/tools.py` → `sold_out_in_size`):

- **The chatbot works out the customer's size** from the conversation: the latest size they mentioned ("size S", "in M", "medium", "2XL", "extra large") or that it looked up for them (a `check_stock`, `find_alternatives`, or `search_products` call with a size).
- **Every recommended product is checked** against the inventory in that size before the reply is sent. If any is sold out in that size, the reply is rejected and the agent must remove or replace it (with `find_alternatives` for that size). The one exception is the product the reply is *telling* the customer is sold out ("Sorry, size L is sold out in the Boola Boola T Shirt"), which can still be named.
- **Page results too:** if the chatbot fills the Products page with a search (Frontend Update 2 / Problem 7) and the customer names a size in that message, the page search is limited to products in stock in that size. (A size from an earlier question no longer filters a new browsing question; see App test Check 2.)

| Test | Result |
|---|---|
| Fake model recommends the District Vit Crewneck Vintage Bulldog (0 in S) to a customer who asked about size S | rejected: "The customer needs size S, but these are sold out in S: District Vit Crewneck Vintage Bulldog…"; final reply recommends an in-stock crewneck instead |
| Baseball Left Chest Crewneck page, "do we have this in black? I'm a size S" | 3 crewnecks, **all in stock in S** (20, 15, and 20 left) |
| Same question with size S mentioned earlier in the chat | same 3 crewnecks, all in stock in S |
| "do you have the Boola Boola T Shirt in L?" (L is sold out) | "**Sorry, size L is sold out**…" + 3 T-shirts **in stock in L** |
| "any bulldog hoodies in XXL?" | the one bulldog hoodie in stock in XXL (25 left); page search limited to XXL, so the Vintage Bulldog hoodie (0 in XXL) isn't shown |

*Why it matters:* recommending an item the customer can't buy in their size is worse than no suggestion. It wastes their time and erodes trust in the assistant. Every suggestion is now something they can actually order.

### Update 2: Four core rules for the chatbot

**The problem.** The chatbot's behavior was spread across many prompt sections, and a few important cases weren't pinned down: which product "it" or "this" means after the conversation moves between products and pages, how many alternatives to name, and a general guarantee that nothing out of stock is ever recommended.

**What changed.** Four rules are now stated at the top of the prompt, under *Four core rules (always follow these)*, and the most important parts are enforced in code, so they hold even if the model slips.

| Rule | What the chatbot does | How it's enforced |
|---|---|---|
| **1. Maintain context** | Always assumes the customer means the **most recently mentioned product** unless they explicitly name a different one. A product counts as mentioned when it's named in the chat **or** when the customer sends a message from its product page. | **Prompt:** Rule 1 with examples. **Code:** each customer message is saved with the product page it was sent from (new `chat_messages.page_product_id` column; guests' browsers send it with their history). The agent sees earlier messages marked "[Sent from the product page for …]". The backend also works out whether the customer **opened the current page since their previous message**, and marks the new message accordingly ("…which the customer opened after their previous message, so it is now the most recently mentioned product"). (`backend/main.py`, `backend/agent.py` → `run_chat`, `_to_model_history`, `_customer_context`) |
| **2. Recommend alternatives** | If an item is out of stock in the requested color or size, it never answers with a bare "No": it says so and **names at least one in-stock alternative** (closest first, up to 3). | **Prompt:** Rule 2 + *Never just say no*. **Code:** if a tool reported something unavailable, the reply must include at least one *other* product, or it's rejected (from Update 1). |
| **3. Ignore graphic colors** | Color availability is based **only on the garment's color** (`primary_color`), never on the colors of printed graphics or lettering. | **Prompt:** Rule 3 + *Product colors*. **Code:** the database stores `primary_color` separately (Front-end Update 1), and the `color` filter in `search_products` / `find_alternatives` matches only the garment color. |
| **4. Filter out-of-stock** | Never recommends a product or size with 0 units in stock. (It may still name the item the customer asked about to tell them it's sold out.) | **Prompt:** Rule 4. **Code:** every recommended product is checked before the reply is sent. It must have stock in some size (`sold_out_everywhere`), and in the customer's size when known (`sold_out_in_size`, from Update 1). Page searches are limited to a size only when the customer mentions it in the current message, so a new browsing question isn't silently filtered by a size from an earlier one (found in App test Check 2). `find_alternatives` only returns in-stock products, and stock answers use `check_stock` / `get_product_details`, which mark 0-quantity sizes as sold out. |

**Tested** (live agent on gpt-6-luna, through the chat API).

| Rule | Situation | Customer says | Chatbot answered |
|---|---|---|---|
| 1 | Asked about the Saybrook College Crewneck, now on the Home page | "is it in XL?" | about the **Saybrook College Crewneck**: "in stock in XL, with 15 available" |
| 1 | Asked about the Saybrook College Crewneck, **then opened the Boola Boola T Shirt page** | "is this in black?" | about the **Boola Boola T Shirt**: not available in black (no black T-shirts right now) + 2 alternatives |
| 1 | On the Basic Hoodie page, asked about the Saybrook College Crewneck, still on that page | "is it in XL?" | about the **Saybrook College Crewneck** (named after the page was opened): XL in stock, 15 available |
| 1 | Asked about Saybrook from the Basic Hoodie page, **then opened the Boola Boola page** | "do you have it in XXL?" | about the **Boola Boola T Shirt**: XXL available, 20 in stock |
| 1 | On the Boola Boola page | "is the Yale Mom Hoodie in black?" | about the **Yale Mom Hoodie** (explicitly named) |
| 2 | — | "do you have the Boola Boola T Shirt in L?" (L = 0) | "**Sorry, the Boola Boola T Shirt is sold out in L.**" + 3 T-shirts in stock in L |
| 3 | Morse Logo T Shirt page (heather gray, black in the crest) | "is this available in black?" | "**Sorry, the Morse Logo T Shirt isn't available in black**" (the black is only in the crest) + alternatives |
| 4 | — | "what sizes of the Saybrook College Crewneck can I get?" | "XS, S, M, L, and XL. **XXL is sold out.**" (XXL not offered) |
| 4 | Test model recommends a crewneck that's sold out in every size (in a test copy of the database) | — | rejected: "These are completely sold out: Champion Mens Triumph Raglan Crew…"; the final reply recommends an in-stock crewneck |

The first run of the "then opened the Boola Boola page" tests failed: the chatbot kept talking about the Saybrook crewneck from earlier in the chat. It didn't know *when* the customer had opened the page. The fix was the per-message page record and the "opened since your previous message" marker described under Rule 1. After it, all five context tests passed.

**How it helps customers.**

- **Natural conversation.** Customers can say "is it in XL?" or "what about black?" without repeating the product name, and the chatbot follows as they move between pages.
- **Always a next step.** An out-of-stock answer always comes with something they can buy.
- **Accurate colors.** "Available in black" means the shirt is black, not that the logo has black in it.
- **Only things they can buy.** Every suggestion is in stock, and in their size when they've said it.

**How it helps the business.**

- **Fewer frustrating misunderstandings.** An assistant that answers about the wrong product feels broken; following context keeps customers engaged.
- **Saved sales.** Every "not available" moment turns into a suggestion instead of a dead end.
- **Fewer returns and complaints.** No orders placed for a color the garment isn't, and no customers sent to a sold-out item.
- **Consistent, checkable behavior.** The rules are written down in one place, and the critical ones are enforced by code, so the chatbot behaves the same for every customer and its behavior can be audited and explained.
