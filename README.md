# RentConnect Ethiopia

A lightweight rental listings page with client-side property filtering, a demo admin dashboard, and a built-in Node.js static server. Listings and accounts shown are sample data. Custom categories are stored in the browser's local storage and are not shared across browsers or devices.

## Requirements

- Node.js 18 or newer

## Run locally

```sh
npm start
```

Open <http://localhost:3000> for rentals or <http://localhost:3000/admin.html> for the demo admin dashboard. Set the `PORT` environment variable to use a different port.

The admin dashboard is a front-end demo only. It has no authentication or server-side account management; its account and activity data are illustrative.

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
