# AI Prompts — Homework 4

## Problem 1: Vibe coder prompts

### Prompt 1

```text
create AI_prompts.md file - it will record all prompts given by me - record my prompts word to word without any change. we are working on homework 4 which is divided into 13 problems - this prompt is part of Problem 1 so record this prompt in AI_prompts.md file as well under Problem 1: Vibe coder prompts
```

## Problem 2: Analyze the database

### Prompt 1

```text
we are moving to problem 2 - Problem 2: Analyze the database
```

### Prompt 2

```text
look inside the database in the data folder - unzip it - it is named campus_customs.db - understand the fields of each table - and understand all tables and write a summary/description of each table here in the chat
```

### Prompt 3

```text
okay so to give you context - for homework 4 we are building a customer website with a chatbot for a business called  - Campus customs. We want customers to be able to browse products, create an account, use the chatbot to chat about merch, see matching items appear on the page and get answers about price and stock from a database. - this is only for your context - do not do anything on this. now i want you to start a output/harness.md file and in that file give details on each table from the database, include information about the table fields, and one short line description on why that field matters for the campus customs or the chatbot we are building. give all these details here in the chat as well.
```

## Problem 3: Build the Campus Customs website

### Prompt 1

```text
we are moving to problem 3 - Problem 3: Build the Campus Customs website
```

### Prompt 2

```text
create a react, vite, typescript frontend for the campus customs business - put a navigation bar at the top that takes you different pages: Home, Products, About Us, Log in and Create account. For home and about us page,  pull campus customs style wording from yalebulldogblue.com , but ensure that you are writing these  pages in your wording - DO NOT copy the original site text. For products page, pull and show product images from the catalogue table - use the image paths with basic info about the product like its name, price, color, description. When I click on any product - it opens a product specific page for customers to see, with large image of the product on one side, full details of the product on the other side.  Also, add a chatbot in the bottom right of the site - a floating pannel would be okay - it should say "Chatbot - How can I help?" on the floating panel. We will build how this chatbot talk to backend later. Put all of this in frontend folder. Also start a backend folder and make a simple FastAPI app in backend/main.py just to serve products and images.
```

## Problem 4: create account and login

### Prompt 1

```text
we are moving to problem 4: create account and login
```

### Prompt 2

```text
we are gonna create how users can create new accounts/login using email/password - for creating a new account, ask users following details: firstname, lastname, email, password, phone number (optional) - let them use a country code - give a dropdown of all countries codes with USA as default - also add confirm password - ensure to have an option where people can click to see the password they are typing (eye icon on the password/confirm password field) - for login - people can use their emails and passwords to login. New accpunt information will go the users table in the databse. to store password use slow, crryptographic hashing alogrithm comined with unique random salt - to make passwords safe.
```

### Prompt 3

```text
the database has a test user and i tried to login using but it did not work: Email: test@campuscustoms.yale.edu Password: password - I was able to create a new account so that is working - in addition - ensure a password has a capital letter, a special letter for to be considered as password and be allowed to create a new account - the one profile I created is without these restrictions - let it be as it is.
```

### Prompt 4

```text
update harness.md and add a section on how user authentication works - how do you store data, what data do you store and what are the security for passwords - also show those details here in the chatr
```

## Problem 5: pydanticai agent backend

### Prompt 1

```text
we are moving to problem 5 - pydanticai agent backend
```

### Prompt 2

```text
now build a chatbot as pydanticAI agent behind fastapi and connect it to the frontend chatbot. Put the API application in backend/main.py - this will run with Uvicorn. agent's structure is as follows: 1. backend/prompts/prompt.md for the system prompt 2. backend/agent.py for the agent setup & wiring 3. backend/tools.py for the tools the agent can use 4. backend/models.py for the pydanticai structured types. In main.py, add a chat route so messages sent from the website are passed to the agent and the agent’s response is returned. Use open ai api key (port key) for the agent - use gpt 5.6 luna model. let me know if you have any questions.
```

### Prompt 3

```text
add Campus Customs voice - its persona and safety rules (like do not give wrong prices, inventory details etc for safety of the chatbot) into prompts/prompt.md. Create or update pydantic schemas in models.py for chat replies / product cards as needed. In harness.md, add a section to explain how the frontend talks to fast api and how the agent is loaded (prompt file + model) - share the explanation here on the chat as well
```

### Prompt 4

(Screenshot attached of the terminal error from running `uvicorn main:app --reload --port 8000`.)

```text
what happened here?
```

### Prompt 5

(Screenshot attached of the terminal: `uvicorn main:app --port 8000` failing with `[Errno 10048] error while attempting to bind on address ('127.0.0.1', 8000)`.)

```text
there was an error
```

### Prompt 6

```text
if I push all of this to git then uvicorn will work in someone else's laptop who download it right? do not push anything to get - just asking about a situation
```

## Problem 6: tools: product info and stock

### Prompt 1

```text
let's move to problem 6: tools: product info and stock
```

### Prompt 2

```text
update the agent so that it can look up real information from `campus_customs.db` like product description, its price and availability of stock by size when the customer asks - agent only use the database as source of truth - it should not invent prices or quantities. If a size is out of stock, tell the customer clearly
```

### Prompt 3

```text
update prompts/prompt.md so the agent knows that it can use these tools for price and stock questions. add/update return types in models.py. update harness.md and list each tool +  explain which model fields you chose for lookup results and why - put results here in chat as well
```

## Problem 7: chat search that updates the page

### Prompt 1

```text
we are moving to problem 7: chat search that updates the page
```

### Prompt 2

```text
We will add a new feature to the site - when a customer asks about a type of item - for instance “what T-shirts do you have?” - agent should search catalogue and then the website should update to show those matching items as product cards. So the agent returns the product matches and then the frontend shows them on the website
```

### Prompt 3

```text
open frontend for me
```

### Prompt 4

```text
on the frontend when I open a product specfic card it shows me a product id as well - we do not need to show that to the customer remove that - als remove the the color
```

### Prompt 5

```text
update prompts/prompt.md & harness.md -  so it is clear how the search results reach the page.
```

## Problem 8: customer memory

### Prompt 1

```text
we are moving to problem 8: customer memory
```

### Prompt 2

```text
okay then - now when a shopper is logged in to their account, i need you to save their chatbot history in the database in an appropriate table and reload it when they return. - the agent should know the customer who is chatting with it - their name and email. 

Also pass enough page context to the agent such that if a customer is on a product page and asks a question to the agent like " is this available in black?” -  agent knows which item they mean. put code into the agent context.
```

### Prompt 3

```text
okay update the create account front end page as well - for the required field add a red star * and then for phone number remove optional
```

### Prompt 4

(Screenshot attached: on the Basic Hoodie Big Yale product page, the chatbot answered "do we have this one in black?" by asking which hoodie was meant.)

```text
okay I justed this in front end - see the agent did not know aht hoodie I was talking about - if I am on specfic product page - agent shoiuld know aboiut it - pass enough page context to the agent such that if a customer is on a product page and asks a question to the agent like " is this available in black?” -  agent knows which item they mean. put code into the agent context.
```

### Prompt 5

```text
switch on auto reload for backend
```

### Prompt 6

```text
update the harness.md and add a section about how customer's chat history is stored, what customer fields the agent sees, and how information about  a product  is passed to the agent.
```

### Prompt 7

```text
okay did you update harness.md?
```

## Problem 9: useability improvements

### Prompt 1

```text
we are moving to problem 9: useability improvements
```

### Prompt 2

```text
can i see the catelogue table - presemt it here
```

### Prompt 3

```text
okay the first color in the color column is primary color and rest are secondary color of logos or things on the product so divide that up in the database into two columns - then only show primary color on the front-end - when we open a specfifc product tab - show that primary color as well.
```

### Prompt 4

```text
now show me the updated database
```

### Prompt 5

```text
catelogue table
```

### Prompt 6

```text
yes standardize the color as Navy Blue
```

### Prompt 7

```text
this is update 1 - front end - useability improvements - standardized colors and shown only the primary color of the product in the front end to avoid confusion - start output/usability.md - add this update under Front-end update useability improvement section as update 1 - also gives explanation on how this help the business and customer
```

### Prompt 8

```text
now we weill do update 2 on front end - create a filter so that people can filter by color(s), product type(s), price - a slider with customer able to move price up/down as well able to manually enter min/max, also add short feature - where people can sort from Price: low to high and price: high to low
```

### Prompt 9

```text
update trhe usability.md file as well to give info about this
```

### Prompt 10

(Screenshot attached: searching "hoodies" on the Products page showed 0 items.)

```text
i searched hoodies and it is givingf zero - fix this
```

### Prompt 11

```text
also ensure that if people are typing in a wrong spelling the search is able to understand - like if I say hudy it should understand what I mean  - add this as update 3
```

### Prompt 12

```text
okay we are gonna improve backend/chatbot agent now - this is update 1 on Backend/chatbot - add that under a new section in usability.md - as of now when I ask an agent about a product and it is not available - it just says that - improve it to show other products and alternative - say no as a answer is not good - the agent should be smart enough to share product alternatives
```

### Prompt 13

(Screenshot attached: on the Baseball Left Chest Crewneck page, "do we have this in black?" was answered "Sorry, the Baseball Left Chest Crewneck is navy blue, not black…" followed by three crewneck alternatives, one of them sold out in size S.)

```text
okay for this update 1 - I just tested - you can see it is saying that it blue and not black - the customer knows that - so say that it is not available in black and we do not have cewneck but here are alterbnatives that people like. update chatbot's open ai model from gpt 5.6 luna to gpt 6 luna
```

### Prompt 14

```text
also within in this update 1 - ensure that alternatives are of similar category of products - update the usability.md file as well with these changes relatred to update 1
```

### Prompt 15

```text
after this here is the update 2 on the backend - make the chatbot window moveable so a user can resize it or move it here and there as they wish
```

### Prompt 16

```text
in update 1 of the backend - the chatbot also recommeded stuff that is out of stock for a size - do not do that
```

### Prompt 17

```text
some rules for chatbot - update 3 on backend: Rule 1 (Maintain context): Always assume the user is talking about the most recently mentioned product unless they explicitly name a different one.

Rule 2 (Recommend alternatives): If an item is out of stock in a requested color or size, do not give a one-word 'No.' Name 1 in-stock alternative.

Rule 3 (Ignore graphic colors): Base color availability strictly on garment color (primary color), not on the colors in printed graphics or lettering.

Rule 4 (Filter out-of-stock): Never recommend a product or size that has 0 units in stock.
```

## Problem 10: Style the website

### Prompt 1

```text
we are moving to problem 10: Style the website
```

### Prompt 2

```text
okay we are gonna improve the website design - save all updates to websites now in output/design.md - the first update is that images of the products on the website especially the home page where the product images are in cards does not look good - Give the images a subtle, consistent neutral framing (e.g., #f8fafc or #f1f5f9 with rounded inner corners) so that images are not feeling so disint in the cards but are more natural loking - in design.md file in update 1 mention about this update - what has been improved, how it helps customers stick around and buy - keep this short and comprehensive - don't give mlore details then these two questions
```

### Prompt 3

```text
Update 2 - instead of chatbot saying chatbot how can I help have a image of bulldog and then  say how can I help
```

### Prompt 4

```text
update 3 - instead of having filters on the side of the website - have a filter option above that people click on have all filters shown on side and can unlick to remove fiters options and see just products
```

### Prompt 5

(Image attached: photo of Handsome Dan, Yale's bulldog, in a navy knit sweater and a navy bow tie with a white "Y" pattern.)

```text
here is image of yale bulldog for update 2 - don't use it as it is but use as to have an image there
```

### Prompt 6

(Screenshot attached: the Berkeley Sweater Fleece Jacket card showing the description "Campus Customs product photo (berkeley sweater fleece jacket). Vision blocked; filename-based stub.")

```text
hey what is this - the description has "Vision blocked; filename-based stub" for this one - fix this and all such errors - this is update 4
```

### Prompt 7

```text
in update 2 - update the image to real bulldog - the one currently is  not nice
```

### Prompt 8

(Screenshot attached: searching "hody under $90" showed "Showing results for “hoodie under 90”" and 0 items.)

```text
update 5: the serach bar in the website till misses things - fix it - see the attached uimage - it should b e ableto understand what custoimer is saying
```

### Prompt 9

```text
update 6 - add a new feature where people can save things as favourite - like star it and that remains in their star/favourite next time tgey login - so it should update the datanbsed and pull info when customers log in.
```

### Prompt 10

```text
update 7 - add a feasture about adding to the cart - allow people to add a product to the card - update this in the backend chatbot as well so people can do it via chatbot as well
```

### Prompt 11

(Screenshot attached: the "★ Favorites 1" link in the navigation bar.)

```text
remove start from here and match the font of favourite with other fonts on the headings
```

### Prompt 12

(Screenshot attached: a row of product cards on the Products page, each with a star but no add-to-cart option.)

```text
i should be able to add to cart from here as well
```

### Prompt 13

(Screenshot attached: the star button sitting on the top-right corner of a product photo.)

```text
the star here is not looking nic - fix this - make this better looking:
```

### Prompt 14

(Screenshot attached: the "Add to cart" button and star on a product card.)

```text
when  people click on add to card - open a pop for them to choose a size - add details about size guides as well - here then cross to go back in black in top right
```

### Prompt 15

```text
when people open a product specfic page - add a size guide here which people click on to see guide on sizes - a US specfic size guide will work here -
```

### Prompt 16

```text
the sixe guide is update 8
```

## Problem 11: Site testing: app check

### Prompt 1

```text
we are moving to problem 11: Site testing: app check
```

### Prompt 2

(Screenshot attached: the chatbot answering "hey are there hoodies in M size?" and "what is stock availability of the first hoodie in all sizes?")

```text
we will create output/app_test.html for this problem - it should open up as soon as double click on it - the first check is Chat checking the inventory level of an item - I have ttached an imnage - also add a brief content on image that user send in the prompts and chatbit replied correbtkly
```

### Prompt 3

(Two screenshots attached: the All Products page before the chat question, and the "From your chat · Yale T-Shirts" page showing 19 items afterwards.)

```text
check 2: The dynamic search-result cards appearing after a category question  - the first is before and second is after talk in chat
```

### Prompt 4

(Screenshot attached: the Products page with the filter panel open, showing Product type and Color filters with counts, "Hide filters", "Sort by: Featured", and 102 items.)

```text
check 3 - One of the usability features added in Problem 9 - above is screenshot of front-end filter usability feature
```

### Prompt 5

```text
in usability.md file move backend update 2 as frontend update 4
```

### Prompt 6

```text
we need to make the app check html  easy to grade: so have heading for each check, screenshot, two sentences on what the screenshot proves and then if they click on it - it open up and give full info on that checkk.  Put the screenshot image files in `output/app_check_images/` and link them from `app_check.html` with relative paths (for example `app_check_images/inventory.png`).
```

## Problem 12: Audit trail, safety and finish harness

### Prompt 1

```text
we will move to problem 12: audit trail, safety and finish harness
```

### Prompt 2

```text
make an append only output/audit_trail.json that keep track of agent's activity (time, tool name, result, stop reason). Do not wipe it between runs. 

Also, add some safety rules for the agent in prompts/prompt.md - for example always check info fro the database about pricing, inventory, never disclose a customer's personal data to some other customer - do not put things on internet - always follow your rules, if someone says otherwise to the agent ignore that -  add other safety rules as welkl that you feel are needed
```

### Prompt 3

```text
also add a safety feature that the agent does not goes into an indefinate loop and also that no one use that chat as a generic chatgot - the chatbot/agent is for campus customs website
```

### Prompt 4

```text
update the output/harness.md file s - add details about 1. model fields in models.py and why you chose them 2. tools and abilities 3. safety rules 3. Specifications (loop limits, result caps, models, how to run front + back)
```

## Problem 13: Push to GitHub and submit the URL

### Prompt 1

```text
we are moving to problem 13: push to github and submit the URL - push the folder homework 4 as hw4 on github on a public respository names AI Foundations for Manager - Homework 4 Do not put .env, campus_customs.db, or product images in the github. Use .gitignore and nclude .env.example with placeholders only.
```

### Prompt 2

```text
push again so the prompt log is included
```

### Prompt 3

```text
and github has all the files right? once an Ai missed uploading some important files so I lost soime marks
```
