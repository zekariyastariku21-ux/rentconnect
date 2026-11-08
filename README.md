# RentConnect Ethiopia

A lightweight rental listings page with client-side property filtering, a database-backed admin dashboard, and a built-in Node.js static server. Accounts, listings, and property categories are stored in `auth.db`.

## Requirements

- Node.js 18 or newer

## Run locally

```sh
npm start
```

Open <http://localhost:3000> for rentals or <http://localhost:3000/admin.html> for the admin dashboard. Set the `PORT` environment variable to use a different port.

## Admin access

New accounts receive the `user` role. To grant administrator access, update the role for a verified account in `auth.db`:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+2519XXXXXXXX';
```

Sign in with that account. The Admin button appears in the site header for administrator accounts, and `/admin.html` requires a valid admin session. The dashboard reads account, listing, and category data from the database. Categories added or removed there are shared with property filters and listing forms; a category cannot be removed while existing listings use it.

## Check JavaScript syntax

```sh
npm run check
```

## Project layout

```text
public/
  index.html
  admin.html
  css/
    styles.css
    admin.css
  js/
    app.js
    admin.js
server.js
package.json
```
