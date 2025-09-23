# Element Admin Console

The Element Admin Console is a web-based administration panel for Matrix homeservers using [Synapse](https://github.com/element-hq/synapse/) and [Matrix Authentication Service (MAS)](https://github.com/element-hq/matrix-authentication-service), written and maintained by [Element](https://element.io/).
It is part of the [Element Server Suite](https://element.io/server-suite), including the free [ESS Community Edition](https://github.com/element-hq/ess-helm).

## 🚀 Quick Start

You can try Element Admin Console immediately using the hosted version at <https://admin-beta.element.dev/>.

Alternatively, run it locally using Docker:

```bash
docker run -p 8080:8080 ghcr.io/element-hq/element-admin-console:latest
```

## 💬 Community room

Developers and users of Element Admin Console can chat in the [#ess-community:element.io](https://matrix.to/#/#ess-community:element.io) room on Matrix.

## 🛠️ Installing and configuration

Element Admin Console is a single-page application (SPA) built with React and TypeScript. It can be deployed as static files to any web server or hosting platform.

### Prerequisites

- A Matrix homeserver with [Synapse](https://github.com/element-hq/synapse) and the [Synapse admin API](https://element-hq.github.io/synapse/latest/reverse_proxy.html#synapse-administration-endpoints) accessible
- A [Matrix Authentication Service](https://github.com/element-hq/matrix-authentication-service) instance with the [MAS admin API](https://element-hq.github.io/matrix-authentication-service/topics/admin-api.html#enabling-the-api) accessible

### Development

1. Clone the repository:

```bash
git clone https://github.com/element-hq/element-admin.git
cd element-admin
```

2. Install dependencies (requires Node.js 18+ and pnpm):

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Building for production

```bash
pnpm build
```

The built application will be in the `dist/` directory, ready to be deployed to any static hosting service.

## 🌍 Translations

Element Admin Console is available in multiple languages.
Anyone can contribute to translations through [Localazy](https://localazy.com/p/element-admin-console).

## 🏗️ Contributing

We welcome contributions from the community! Please read our contribution guidelines before getting started.

### Development workflow

- **Linting & Formatting:** Run `pnpm lint` to check code style and `pnpm fix` to auto-fix issues
- **Translation extraction:** Run `pnpm i18n:extract` when adding new translatable strings

## ⚖️ Copyright & License

Copyright 2025 New Vector Ltd.

This software is dual-licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, version 3 of the License); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).

Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
