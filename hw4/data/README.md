# data/

The course database and product photos are **not** in this repository. To run the site, put them here:

```
data/
├── campus_customs.db     # SQLite database: catalogue, inventory, users, chat_messages
└── products/             # product photos, e.g. basic-hoodie-big-yale.jpg
```

The backend adds its own tables (`sessions`, `favorites`, `cart_items`) and the catalogue color fixes automatically when it starts.
