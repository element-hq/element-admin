<!--
SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
-->

# Element Admin

Element Admin is a web-based administration panel for the [Element Server Suite](https://element.io/server-suite), available in both [ESS Pro](https://element.io/server-suite/pro) and in the free [ESS Community](https://github.com/element-hq/ess-helm) edition.

## 🚀 Quick Start

You can try the latest Element Admin using the hosted version at <https://admin-beta.element.dev/>.

## 💬 Community room

Developers and users of Element Admin can chat in the [#ess-community:element.io](https://matrix.to/#/#ess-community:element.io) room on Matrix.

## 🛠️ Installing and configuration

Element Admin ships as part of the [Element Server Suite](https://element.io/server-suite) and is **enabled by default, starting version 25.9.2**.
Refer to the [ESS setup instructions](https://github.com/element-hq/ess-helm#installation) for more information.

### 📝 Prerequisites

Element Admin is designed to work with the components that ship with ESS.
It assumes the following, which is **handled out of the box by ESS version 25.9.2 or later**:

- A [Synapse](https://github.com/element-hq/synapse) instance and [its admin API](https://element-hq.github.io/synapse/latest/reverse_proxy.html#synapse-administration-endpoints) accessible
- A [Matrix Authentication Service](https://github.com/element-hq/matrix-authentication-service) instance with [its admin API](https://element-hq.github.io/matrix-authentication-service/topics/admin-api.html#enabling-the-api) accessible
- An domain name with a valid SSL certificate (HTTPS) where to host Element Admin. It _must_ be served from a secure context, as required by the next-generation auth Matrix APIs.

Under the hood, Element Admin is a single-page application React application which can be deployed in any static hosting service or container environment.

<details>
<summary>

#### 🐳 Using Docker

</summary>

A pre-built Docker image is available on [GitHub Container Registry](https://github.com/element-hq/element-admin/pkgs/container/element-admin).

```bash
docker run -p 8080:8080 ghcr.io/element-hq/element-admin:main
```

It can be configured using the following environment variables:

| Variable      | Description                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `SERVER_NAME` | The name of the Matrix server to use. If not set, the user will be prompted to enter a server name. |

A local Docker image can be built from the source code using the following command:

```bash
docker build -t element-admin .
```

</details>

<details>
<summary>

#### 📦 Building from the source code

</summary>

1. Clone the repository:

```bash
git clone https://github.com/element-hq/element-admin.git
cd element-admin
```

2. Install dependencies (requires Node.js 18+ and pnpm):

```bash
pnpm install
```

3. Build the application

```bash
pnpm build
```

The built application will be in the `dist/` directory, ready to be deployed to any static hosting service.

</details>

## 🌍 Translations

Element Admin Console is available in multiple languages.
Anyone can contribute to translations through [Localazy](https://localazy.com/p/element-admin).

## 🏗️ Contributing

We welcome contributions from the community! If you'd like to suggest changes or contribute to the project, please come and chat with us first in the [#ess-community:element.io](https://matrix.to/#/#ess-community:element.io) room on Matrix.

### Development workflow

- **Linting & Formatting:** Run `pnpm lint` to check code style and `pnpm fix` to auto-fix issues
- **Translation extraction:** Run `pnpm i18n:extract` when adding new translatable strings

## ⚖️ Copyright & License

Copyright 2025 New Vector Ltd.

This software is dual-licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, version 3 of the License); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).

Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.
